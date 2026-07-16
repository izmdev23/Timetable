use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message;

type ClientId = usize;
type Tx = tokio::sync::mpsc::UnboundedSender<Message>;

#[derive(Clone)]
pub struct CollabServerState {
    running: Arc<AtomicBool>,
    port: Arc<AtomicU16>,
    clients: Arc<Mutex<HashMap<ClientId, ClientInfo>>>,
    next_id: Arc<Mutex<ClientId>>,
    shutdown_tx: Arc<Mutex<Option<broadcast::Sender<()>>>>,
}

#[derive(Clone)]
struct ClientInfo {
    tx: Tx,
    #[allow(dead_code)]
    addr: SocketAddr,
}

impl CollabServerState {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            port: Arc::new(AtomicU16::new(0)),
            clients: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(1)),
            shutdown_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(&self, port: u16) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Err("Server already running".to_string());
        }

        let addr = format!("0.0.0.0:{}", port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to port {}: {}", port, e))?;

        let (shutdown_tx, _) = broadcast::channel::<()>(1);
        *self.shutdown_tx.lock().await = Some(shutdown_tx.clone());
        self.running.store(true, Ordering::SeqCst);
        self.port.store(port, Ordering::SeqCst);

        let state = self.clone();
        tokio::spawn(async move {
            loop {
                let mut shutdown_rx = shutdown_tx.subscribe();
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, addr)) => {
                                let state = state.clone();
                                tokio::spawn(async move {
                                    if let Err(e) = handle_connection(state, stream, addr).await {
                                        log::error!("Collab connection error: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                log::error!("Collab accept error: {}", e);
                            }
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        log::info!("Collab server shutting down");
                        break;
                    }
                }
            }

            let mut clients = state.clients.lock().await;
            for (_, info) in clients.drain() {
                let _ = info.tx.send(Message::Close(None));
            }
            drop(clients);
            state.running.store(false, Ordering::SeqCst);
            log::info!("Collab server stopped");
        });

        Ok(())
    }

    pub async fn stop(&self) -> Result<(), String> {
        if !self.running.load(Ordering::SeqCst) {
            return Err("Server not running".to_string());
        }

        let shutdown_tx = self.shutdown_tx.lock().await.take();
        if let Some(tx) = shutdown_tx {
            let _ = tx.send(());
        }

        Ok(())
    }

    pub async fn get_status(&self) -> CollabStatus {
        let peer_count = self.clients.lock().await.len();
        CollabStatus {
            running: self.running.load(Ordering::SeqCst),
            port: self.port.load(Ordering::SeqCst),
            peer_count,
        }
    }

    async fn register_client(&self, tx: Tx, addr: SocketAddr) -> ClientId {
        let mut next_id = self.next_id.lock().await;
        let id = *next_id;
        *next_id += 1;

        let mut clients = self.clients.lock().await;
        clients.insert(id, ClientInfo { tx, addr });
        id
    }

    async fn unregister_client(&self, id: ClientId) {
        let mut clients = self.clients.lock().await;
        clients.remove(&id);
    }

    async fn broadcast(&self, message: &str, exclude_id: Option<ClientId>) {
        let clients = self.clients.lock().await;
        for (&id, info) in clients.iter() {
            if Some(id) == exclude_id {
                continue;
            }
            let _ = info.tx.send(Message::Text(message.to_string()));
        }
    }
}

async fn handle_connection(
    state: CollabServerState,
    stream: tokio::net::TcpStream,
    addr: SocketAddr,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ws_stream = tokio_tungstenite::accept_async(stream).await?;
    let (mut ws_tx, mut ws_rx) = ws_stream.split();

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
    let client_id = state.register_client(tx, addr).await;

    let welcome = serde_json::json!({
        "type": "welcome",
        "clientId": client_id
    });
    ws_tx
        .send(Message::Text(welcome.to_string()))
        .await?;

    let forward_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(msg) = ws_rx.next().await {
        match msg? {
            Message::Text(text) => {
                state.broadcast(&text, Some(client_id)).await;
            }
            Message::Close(_) => break,
            Message::Ping(_) => {}
            Message::Pong(_) => {}
            Message::Binary(_) => {}
            Message::Frame(_) => {}
        }
    }

    forward_task.abort();
    state.unregister_client(client_id).await;

    let leave_msg = serde_json::json!({
        "type": "peer:left",
        "clientId": client_id
    });
    state
        .broadcast(&leave_msg.to_string(), Some(client_id))
        .await;

    Ok(())
}

#[derive(serde::Serialize, Clone)]
pub struct CollabStatus {
    pub running: bool,
    pub port: u16,
    pub peer_count: usize,
}
