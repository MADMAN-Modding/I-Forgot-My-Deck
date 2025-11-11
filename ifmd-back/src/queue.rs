pub struct QueueItem {
    pub queue_type: QueueType,
    
}

pub enum QueueType {
    IDLookup,
    CardArtLookup
}