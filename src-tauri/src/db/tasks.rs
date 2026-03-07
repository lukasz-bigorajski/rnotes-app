use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteTask {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub is_checked: bool,
    pub notify_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}
