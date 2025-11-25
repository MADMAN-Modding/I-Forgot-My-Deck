use std::{collections::HashSet, env};

use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Pool, Row, Sqlite,
};

use crate::{card::Card, constants};

/// Connects to the sqlite database and runs migrations
///
/// # Returns
/// `Pool<Sqlite>` - Interact with the database
pub async fn start_db() -> Pool<Sqlite> {
    unsafe {
        env::set_var("DATABASE_URL", "sqlite://database.sqlite");
    }

    let db_path = if cfg!(debug_assertions) {
        "database.sqlite".to_string()
    } else {
        constants::get_db_path()
    };

    let database = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(db_path)
                .create_if_missing(true),
        )
        .await
        .expect("Couldn't connect to database");



    match sqlx::migrate!("./migrations").run(&database).await {
        Ok(_) => {}
        Err(e) => eprintln!("Migration Error: {}", e),
    };

    database
}

/// Inserts data into the database
///
/// # Arguments
/// * `database: &Pool<Sqlite>` - Database to use to execute
/// * `card: Card` - Struct to insert
///
/// # Returns
/// * `Ok()` - Insertion succeeds
/// * `Err(sqlx::Error)` - Insertion fails
pub async fn input_card(database: &Pool<Sqlite>, card: &Card) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO card_name_to_id_cache (name, display_name, id, url, set_id)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#
    )
    .bind(&card.name.to_lowercase())
    .bind(&card.display_name.as_deref().unwrap_or(""))
    .bind(&card.id.to_lowercase())
    .bind(&card.url.to_lowercase())
    .bind(&card.set_id.as_deref().unwrap_or("").to_lowercase())
    .execute(&*database)
    .await?;

    Ok(())
}

pub async fn check_card_exists_by_name(name_or_id: &str, set: &str, database: &Pool<Sqlite>) -> bool {
    let query = r#"
        SELECT * FROM card_name_to_id_cache
        WHERE (name = ?1 OR id = ?1) AND set_id = ?2
        ORDER BY RANDOM()
        LIMIT 1
    "#;

    match sqlx::query_scalar::<_, String>(query)
        .bind(name_or_id.to_lowercase())
        .bind(set.to_lowercase())
        .fetch_optional(&*database)
        .await
    {
        // Found an entry matching this id
        Ok(v) => {if v.is_some() {true} else {false}},
        // Didn't find an entry matching this id
        Err(_) => false,
    }
}

/// Get all the different device uids
///
/// # Arguments
/// * `database: &Pool<Sqlite>` - Database to execute the query
///
/// # Returns
/// `HashSet<String>` - Contains all the different device uids
pub async fn get_all_cached_cards(database: &Pool<Sqlite>) -> HashSet<String> {
    let mut uids = HashSet::new();

    let rows = sqlx::query("SELECT id FROM card_name_to_id_cache")
        .fetch_all(database)
        .await
        .expect("Failed to fetch device IDs");

    for row in rows {
        let card_id = row.get::<String, _>("card_id");

        uids.insert(card_id);
    }

    uids
}

pub async fn get_card_id_from_name(
    database: &Pool<Sqlite>,
    card_name: &str,
) -> String {
    let row = match sqlx::query("SELECT id FROM card_name_to_id_cache WHERE name = ?1")
        .bind(card_name.to_lowercase())
        .fetch_one(&*database)
        .await {
            Ok(v) => v,
            Err(e) => {println!("Error: {:?}", e); return String::new()},
        };

    row.get("id")
}

pub async fn get_card_by_id(
    database: &Pool<Sqlite>,
    card_id: &str,
) -> Card {
    let row = sqlx::query_as::<_, Card>(
        r#"
        SELECT * FROM card_name_to_id_cache
        WHERE id = ?1
        ORDER BY RANDOM()
        LIMIT 1
        "#,
    )
    .bind(card_id)
    .fetch_one(database)
    .await
    .expect("Failed to fetch card by ID");

    row
}