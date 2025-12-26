use core::fmt;
use std::sync::Arc;

use futures::lock::Mutex;
use once_cell::sync::OnceCell;
use serde_json::Value;
use tokio::sync::oneshot;

use crate::{constants, deck::cache, state};

pub struct QueueManager {
    pub queue: OnceCell<Arc<Mutex<Vec<QueueTask>>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        let cell = OnceCell::new();
        cell.set(Arc::new(Mutex::new(Vec::<QueueTask>::new())))
            .unwrap();

        Self { queue: cell }
    }

    pub async fn push_back(&self, task: QueueTask) {
        self.queue.get().unwrap().lock().await.push(task);
    }
}

/// A task in the fetch queue
pub struct QueueTask {
    /// The type of task
    pub queue_type: QueueType,
    /// The identifier for the task (card ID or name)
    pub identifier: String,
    /// The set for the task (optional, used for name lookups)
    pub set: String,
    /// The response channel to send the result back
    pub response: oneshot::Sender<Result<Value, anyhow::Error>>,
}

#[derive(Clone)]
/// The type of task in the queue
pub enum QueueType {
    /// Lookup card by ID
    ArtIDLookup,
    /// Lookup card by exact name
    ArtNameLookup,
}

impl fmt::Display for QueueType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            QueueType::ArtIDLookup => write!(f, "ArtIDLookup"),
            QueueType::ArtNameLookup => write!(f, "ArtNameLookup"),
        }
    }
}

/// Get the next item from the queue
pub fn next_queue_item(queue: &mut Vec<QueueTask>) -> Option<QueueTask> {
    if queue.is_empty() {
        None
    } else {
        println!(
            "Dequeuing task: {} - {} - {}",
            queue[0].queue_type, queue[0].identifier, queue[0].set
        );

        Some(queue.remove(0))
    }
}

pub async fn manage_queue(state: Arc<state::AppState>) {
    loop {
        let queue_manager = &state.fetch_queue;

        if queue_manager.queue.get().unwrap().lock().await.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(constants::SCRY_DELAY)).await;
        } else {
            let queue = &mut queue_manager.queue.get().unwrap().lock().await;

            let task = next_queue_item(queue);
            match task {
                Some(task) => {
                    let response: std::result::Result<Value, anyhow::Error>;

                    match task.queue_type {
                        QueueType::ArtIDLookup => {
                        // response = cache::get_or_fetch_card_by_id(&task.identifier, &state).await.and_then(|card| Ok(card.to_json()));
                        //     if let Err(ref err) = response {
                        //         eprintln!(
                        //             "Error processing ID Lookup for {}: {}",
                        //             task.identifier, err
                        //         );
                        //     }
                            response = Err(anyhow::anyhow!("ArtIDLookup no longer implemented"));
                        }
                        QueueType::ArtNameLookup => {
                            // Handle Card Art Lookup
                            response = cache::get_or_fetch_card_by_exact_name(
                                &task.identifier,
                                &task.set,
                                &state,
                            )
                            .await.and_then(|card| Ok(card.to_json()));
                            if let Err(ref err) = response {
                                eprintln!(
                                    "Error processing Name Lookup for {}: {}",
                                    task.identifier, err
                                );
                            }
                        }
                    };

                    let _ = task.response.send(response);

                    println!(
                        "Finished queue task: {} - {} - {}",
                        task.queue_type, task.identifier, task.set
                    );

                    tokio::time::sleep(std::time::Duration::from_millis(constants::SCRY_DELAY)).await;
                }
                None => {}
            }
        }
    }
}
