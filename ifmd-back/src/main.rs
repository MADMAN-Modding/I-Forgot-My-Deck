use axum::{Router, routing::get};
use ifmd_back::{routes::{cards::get_card_by_id, ws::ws_handler}, state};
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let app_state = std::sync::Arc::new(state::AppState::new());

    // Define your router
    let app = Router::new()
        .route("/api/cards/:id", get(get_card_by_id))
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
