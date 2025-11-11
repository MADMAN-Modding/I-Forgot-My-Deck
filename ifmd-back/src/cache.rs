use std::{path::PathBuf, sync::Arc};

use crate::{card::Card, database, state::AppState};
use reqwest::header::{ACCEPT, USER_AGENT};
use tokio::fs as tfs;

pub async fn get_or_fetch_card_by_id(id: &str, _state: Arc<AppState>) -> Result<Card, anyhow::Error> {
    // Create directory split for first 2 hex chars of the UUID
    let prefix = &id[0..2];
    let dir = format!("cache/{prefix}");
    tfs::create_dir_all(&dir).await?;

    let file_path = format!("{dir}/{id}.png");
    let path = PathBuf::from(&file_path);

    if path.exists() {
        return Ok(Card::new(id.to_string(), id.to_string(), file_path));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    // Fetch metadata from Scryfall API
    let url = format!("https://api.scryfall.com/cards/{id}");
    let res = client
        .get(&url)
        .header(USER_AGENT, "I-Forgot-My-Deck/0.1")
        .header(ACCEPT, "applications/json")
        .send()
        .await?.json::<serde_json::Value>().await?;

    let img_url = res["image_uris"]["normal"].as_str().ok_or_else(|| anyhow::anyhow!("No image for card ID: {id}"))?;
    
    // Download image bytes
    let img_bytes = reqwest::get(img_url).await?.bytes().await?;
    tfs::write(&path, &img_bytes).await?;

    Ok(Card::new(id.to_string(), id.to_string(), img_url.to_string()))
}

pub async fn get_or_fetch_card_by_exact_name(card_name: &str, _state: Arc<AppState>) -> Result<Card, anyhow::Error> {
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    // Fetch metadata from Scryfall API
    let url = format!("https://api.scryfall.com/cards/named?exact={card_name}");
    let res = client
        .get(&url)
        .header(USER_AGENT, "I-Forgot-My-Deck/0.1")
        .header(ACCEPT, "applications/json")
        .send()
        .await?.json::<serde_json::Value>().await?;

    let card_id = res["id"].as_str().ok_or_else(|| anyhow::anyhow!("No image for card: {card_name}"))?;
    
    let card = Card::new(card_name.to_string(), card_id.to_string(), res["image_uris"]["normal"].as_str().ok_or_else(|| anyhow::anyhow!("No image for card: {card_name}"))?.to_string());

    database::input_card(&_state.database, &card).await?;

    Ok(card)
}