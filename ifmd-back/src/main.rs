use axum::{Router, routing::get};
use ifmd_back::{constants, database, parse_deck, routes::{
        cards::{get_card_by_exact_name, get_card_by_id},
        ws::ws_handler,
    }, state
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    constants::setup();

    let deck = parse_deck::read_deck_file("deck.txt").expect("Failed to read deck file");
    deck.list_cards();
    
    let db = database::start_db().await;

    let app_state = Arc::new(state::AppState::new(db));

    // Spawn queue thread
    let state_clone = app_state.clone();
    tokio::spawn(async move {
        ifmd_back::queue::manage_queue(state_clone).await;
    });

    // Define your router
    let app = Router::new()
        .route("/api/cards/id/:id", get(get_card_by_id))
        .route("/api/cards/name/:card_name/:card_set", get(get_card_by_exact_name))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state.clone());

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {addr}");

    // Add the deck to the queue for processing
    let fetch_queue = &app_state.fetch_queue;
    for card in deck.cards {
        fetch_queue.push_back(ifmd_back::queue::QueueTask {
            queue_type: ifmd_back::queue::QueueType::ArtNameLookup,
            identifier: card.card_name.clone(),
            set: card.card_set.clone().unwrap_or_default(),
        }).await;
    }

    axum_server::bind(addr)
        .serve(app.into_make_service())
        .await
        .unwrap();


}
