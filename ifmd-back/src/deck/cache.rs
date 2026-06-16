use std::{path::PathBuf, sync::Arc};

use crate::{constants::get_card_storage_dir, database, deck::card::Card, state::AppState};
use reqwest::header::{ACCEPT, USER_AGENT};
use tokio::fs as tfs;

pub async fn get_or_fetch_card_by_exact_name(card_name: &str, set: &str, state: &Arc<AppState>) -> Result<Card, anyhow::Error> {
    
    if database::check_card_exists_by_name(card_name, set, &state.database).await {
        let card_id = database::get_card_id_from_name(&state.database, card_name).await;

        let mut card = database::get_card_by_id(&state.database, &card_id).await;

        card.url = build_path(&card.id, true).await?;

        return Ok(card);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    // Fetch metadata from Scryfall API
    let url = format!("https://api.scryfall.com/cards/named?exact={card_name}&set={set}");
    let res = client
        .get(&url)
        .header(USER_AGENT, "I-Forgot-My-Deck/0.1")
        .header(ACCEPT, "applications/json")
        .send()
        .await?.json::<serde_json::Value>().await?;

    let card_id = res["id"].as_str().ok_or_else(|| anyhow::anyhow!("No id for card: {card_name}"))?;
    let file_path = build_path(card_id, false).await?;
    let card_display_name = res["name"].as_str();
    let card_img_download: &str;

    // Only layouts with per-face image_uris on opposite physical sides of the card
    // should be treated as double-faced. "split" and "flip" cards also use "//" in
    // their names but have a single root-level image_uris object.
    let layout = res["layout"].as_str().unwrap_or("normal");
    let is_two_faced: bool = matches!(layout, "transform" | "modal_dfc" | "double_faced_token" | "art_series" | "reversible_card");

    if is_two_faced {
        card_img_download = res["card_faces"][0]["image_uris"]["normal"].as_str().ok_or_else(|| anyhow::anyhow!("No front image for card: {card_name}"))?;

        // Download Front Face
        download_image(card_img_download, &file_path, card_id).await?;

        // Download Back Face
        let back_file_path = file_path.replace(".png", "_back.png");
        let back_img_url = res["card_faces"][1]["image_uris"]["normal"].as_str().ok_or_else(|| anyhow::anyhow!("No back image for card: {card_name}"))?;
        download_image(back_img_url, &back_file_path, &format!("{}_back", card_id)).await?;

    } else {
        card_img_download = res["image_uris"]["normal"].as_str().ok_or_else(|| anyhow::anyhow!("No image for card: {card_name}"))?;
        download_image(&card_img_download, &file_path, card_id).await?;
    }

    let card = Card::new(card_name.to_string(), card_display_name.map(|s| s.to_string()), card_id.to_string(), build_path(&card_id, true).await?, Some(set.to_string()), false, is_two_faced);

    database::input_card(&state.database, &card).await?;

    Ok(card)
}

async fn download_image(img_url: &str, relative_path: &str, id: &str) -> Result<(), anyhow::Error> {
    if !check_card_downloaded(id).await {
        let img_bytes = reqwest::get(img_url).await?.bytes().await?;
        let dump_directory = get_card_storage_dir();
        let path = PathBuf::from(dump_directory).join(relative_path);

        tfs::create_dir_all(path.parent().unwrap()).await?;
        tfs::write(&path, &img_bytes).await?;
    }
    Ok(())
}

async fn check_card_downloaded(id: &str) -> bool {
   let relative_path = build_path(id, false).await.unwrap();
    let path = PathBuf::from(get_card_storage_dir()).join("cache/").join(relative_path);
    path.exists()
}

async fn build_path(id: &str, full: bool) -> Result<String, anyhow::Error> {
    // Create directory split for first 2 hex chars of the UUID
    let prefix:(&str, &str) = (&id[0..1], &id[1..2]);

    let mut path = format!("{}/{}/{}.png", prefix.0, prefix.1, id);

    if full {
        path = format!("images/cache/{path}")
    }

    Ok(path)

}

// Not used
// 
// Retained for potential future use
// pub async fn get_or_fetch_card_by_id(card_id: &str, _state: &Arc<AppState>) -> Result<Card, anyhow::Error> {
//     // Create directory split for first 2 hex chars of the UUID
//     let file_path = build_path(card_id).await?;
//     let path = PathBuf::from(&file_path);
//     if path.exists() {
//         return Ok(Card::new(card_id.to_string(), card_id.to_string(), file_path, None));
//     }

//     let client = reqwest::Client::builder()
//         .timeout(std::time::Duration::from_secs(10))
//         .build()?;

//     // Fetch metadata from Scryfall API
//     let url = format!("https://api.scryfall.com/cards/{card_id}");
//     let res = client
//         .get(&url)
//         .header(USER_AGENT, "I-Forgot-My-Deck/0.1")
//         .header(ACCEPT, "applications/json")
//         .send()
//         .await?.json::<serde_json::Value>().await?;

//     let img_url = res["image_uris"]["normal"].as_str().ok_or_else(|| anyhow::anyhow!("No image for card ID: {card_id}"))?;
    
//     download_image(img_url, &file_path, card_id).await?;

//     Ok(Card::new(card_id.to_string(), card_id.to_string(), img_url.to_string(), None))
// }