use axum::{Router, routing::get};
use ifmd_back::{constants, database, routes::{cards::{get_card_by_exact_name, get_card_by_id}, ws::ws_handler}, state};
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    constants::setup();

    let db = database::start_db().await;

    let app_state = std::sync::Arc::new(state::AppState::new(db));

    // Define your router
    let app = Router::new()
        .route("/api/cards/id/:id", get(get_card_by_id))
        .route("/api/cards/name/:name", get(get_card_by_exact_name))
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
