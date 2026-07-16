use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::Emitter;

const SERVICE_TYPE: &str = "_timetable-collab._tcp.local.";

pub struct DiscoveryState {
    browsing: Mutex<Option<ServiceDaemon>>,
    hosting: Mutex<Option<ServiceDaemon>>,
    cancel: Arc<AtomicBool>,
}

impl DiscoveryState {
    pub fn new() -> Self {
        Self {
            browsing: Mutex::new(None),
            hosting: Mutex::new(None),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start_host_advertisement(
        &self,
        hostname: &str,
        port: u16,
        ips: &[String],
    ) -> Result<(), String> {
        let daemon = ServiceDaemon::new().map_err(|e| format!("mDNS daemon error: {}", e))?;

        let ip = ips
            .first()
            .map(|s| s.split(' ').next().unwrap_or("127.0.0.1"))
            .unwrap_or("127.0.0.1")
            .to_string();

        let host_full = format!("{}.local.", hostname);

        let properties = [("hostname".to_string(), hostname.to_string())];

        let service_info = ServiceInfo::new(SERVICE_TYPE, hostname, &host_full, &ip, port, &properties[..])
            .map_err(|e| format!("Failed to create service info: {}", e))?;

        daemon
            .register(service_info)
            .map_err(|e| format!("Failed to register mDNS service: {}", e))?;

        *self.hosting.lock().unwrap() = Some(daemon);
        Ok(())
    }

    pub fn stop_host_advertisement(&self) {
        if let Some(daemon) = self.hosting.lock().unwrap().take() {
            drop(daemon);
        }
    }

    pub fn start_browsing(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        self.cancel.store(false, Ordering::SeqCst);

        let daemon = ServiceDaemon::new().map_err(|e| format!("mDNS daemon error: {}", e))?;

        let receiver = daemon
            .browse(SERVICE_TYPE)
            .map_err(|e| format!("Failed to browse mDNS: {}", e))?;

        let cancel = self.cancel.clone();
        std::thread::spawn(move || {
            while !cancel.load(Ordering::SeqCst) {
                match receiver.recv_timeout(std::time::Duration::from_millis(500)) {
                    Ok(ServiceEvent::ServiceResolved(info)) => {
                        let hostname = info.get_fullname().to_string();
                        let port = info.get_port();
                        let addr = info
                            .get_addresses()
                            .iter()
                            .next()
                            .map(|a| a.to_string())
                            .unwrap_or_default();
                        let _ = app_handle.emit(
                            "collab:discovered-host",
                            serde_json::json!({
                                "hostname": hostname,
                                "ip": addr,
                                "port": port,
                            }),
                        );
                    }
                    _ => {}
                }
            }
        });

        *self.browsing.lock().unwrap() = Some(daemon);
        Ok(())
    }

    pub fn stop_browsing(&self) {
        self.cancel.store(true, Ordering::SeqCst);
        if let Some(daemon) = self.browsing.lock().unwrap().take() {
            drop(daemon);
        }
    }
}
