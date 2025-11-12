use core::fmt;
use std::{sync::Arc, thread};

use futures::lock::Mutex;
use once_cell::sync::OnceCell;

use crate::{cache, state};

pub struct QueueManager {
    pub queue: OnceCell<Arc<Mutex<Vec<QueueTask>>>>,
}

impl QueueManager {
    pub fn new() -> Self {

        let cell = OnceCell::new();
        cell.set(Arc::new(Mutex::new(Vec::<QueueTask>::new()))).unwrap();

        Self {
            queue: cell,
        }
    }

    pub async fn push_back(&self, task: QueueTask) {
        self.queue.get().unwrap().lock().await.push(task);
    }
}

#[derive(Clone)]
/// A task in the fetch queue
pub struct QueueTask {
    /// The type of task
    pub queue_type: QueueType,
    /// The identifier for the task (card ID or name)
    pub identifier: String,
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

static QUEUE_DELAY_MS: u64 = 150;

/// Get the next item from the queue
pub fn next_queue_item(queue: &mut Vec<QueueTask>) -> Option<QueueTask> {
    if queue.is_empty() {
        None
    } else {
        Some(queue.remove(0))
    }
}

pub async fn manage_queue(state: Arc<state::AppState>) {
    loop {
        let queue_manager = &state.fetch_queue;
        
        if queue_manager.queue.get().unwrap().lock().await.is_empty() {
            println!("Queue is empty, waiting...");
            thread::sleep(std::time::Duration::from_millis(QUEUE_DELAY_MS));
        } else {
            println!("Queue has {} items", queue_manager.queue.get().unwrap().lock().await.len());
            let task = next_queue_item(&mut queue_manager.queue.get().unwrap().lock().await.to_vec());
            match task {
                Some(task) => {
                    println!(
                        "Processing queue task: {} - {}",
                        task.queue_type, task.identifier
                    );
                    match task.queue_type {
                        QueueType::ArtIDLookup => {
                            match cache::get_or_fetch_card_by_id(&task.identifier, &state).await {
                                Ok(_) => {
                                    // Successfully processed ID Lookup
                                    // !todo!("Handle successful ID Lookup");
                                }
                                Err(err) => {
                                    eprintln!(
                                        "Error processing ID Lookup for {}: {}",
                                        task.identifier, err
                                    );
                                }
                            }
                            // Handle ID Lookup
                        }
                        QueueType::ArtNameLookup => {
                            // Handle Card Art Lookup
                            match cache::get_or_fetch_card_by_exact_name(&task.identifier, &state)
                                .await
                            {
                                Ok(_) => {
                                    // Successfully processed Name Lookup
                                    // !todo!("Handle successful Name Lookup");
                                }
                                Err(err) => {
                                    eprintln!(
                                        "Error processing Name Lookup for {}: {}",
                                        task.identifier, err
                                    );
                                }
                            }
                        }
                    }

                    println!(
                        "Finished queue task: {} - {}",
                        task.queue_type, task.identifier
                    );

                    // Remove item from queue
                    queue_manager.queue.get().unwrap().lock().await.remove(0);

                    thread::sleep(std::time::Duration::from_millis(QUEUE_DELAY_MS));
                }
                None => {}
            }
        }
    }
}
