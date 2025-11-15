use axum::{Router, routing::get};
use ifmd_back::{constants, database, routes::{
        cards::get_card_by_exact_name,
        ws::ws_handler,
    }, state
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    constants::setup();

    let db = database::start_db().await;

    let app_state = Arc::new(state::AppState::new(db));

    // Spawn queue thread
    let state_clone = app_state.clone();
    tokio::spawn(async move {
        ifmd_back::queue::manage_queue(state_clone).await;
    });

    // Define your router
    let app = Router::new()
        .route("/api/cards/name/:card_name/:card_set", get(get_card_by_exact_name))
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state.clone());

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {addr}");

    axum_server::bind(addr)
        .serve(app.into_make_service())
        .await
        .unwrap();


}
