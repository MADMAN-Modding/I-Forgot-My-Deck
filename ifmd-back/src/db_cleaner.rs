use std::time::Duration;

use chrono::{NaiveDateTime, TimeZone, Utc};
use sqlx::{Error, Pool, Sqlite};

use crate::{account::{code::Code, token::Token}, constants, database::{delete_row, get_all_rows}};

fn sqlite_time_to_epoch_seconds(time: &str) -> Result<i64, Error> {
    // SQLite CURRENT_TIMESTAMP format: "YYYY-MM-DD HH:MM:SS"
    let naive = NaiveDateTime::parse_from_str(time, "%Y-%m-%d %H:%M:%S")
        .map_err(|e| Error::Decode(Box::new(e)))?;

    Ok(Utc.from_utc_datetime(&naive).timestamp())
}

fn older_than_x_min(time: &i64, x_min: i64) -> bool {
    let current_time = Utc::now().timestamp();

    current_time - time > x_min * 60
}

pub async fn run_clean(database: Pool<Sqlite>) {
    loop {
        let tokens: Vec<Token> = get_all_rows(&database, "tokens").await.expect("Error getting tokens");

        for token in tokens {
            let time = sqlite_time_to_epoch_seconds(&token.time).expect(format!("Error reading the time {}", token.time).as_str());

            if older_than_x_min(&time, constants::TOKEN_EXPIRATION) {
                delete_row(&database, "tokens", &token).await.unwrap();
            }
        }

        let codes: Vec<Code> = get_all_rows(&database, "codes").await.expect("Error getting codes");

        for code in codes {
            let time = sqlite_time_to_epoch_seconds(&code.time).unwrap();

            if older_than_x_min(&time, constants::CODE_EXPIRATION) {
                delete_row(&database, "codes", &code).await.unwrap();
            }
        }

        tokio::time::sleep(Duration::from_mins(constants::CLEAN_DELAY)).await;
    }
}