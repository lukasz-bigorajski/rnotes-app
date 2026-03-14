use rusqlite::Connection;
use super::schema;

pub fn test_connection() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    schema::run_migrations(&conn).unwrap();
    conn
}
