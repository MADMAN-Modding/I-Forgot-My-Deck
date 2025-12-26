use axum::{Router, routing::get};
use ifmd_back::{constants, database, routes::{
        accounts::{auth_account, make_account, token_auth, verify_account}, cards::get_card_by_exact_name
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
        .route("/api/card/name/:card_name/:card_set", get(get_card_by_exact_name))
        .route("/api/account/create/:display_name/:id/:email/:pass", get(make_account))
        .route("/api/account/auth/:id/:pass", get(auth_account))
        .route("/api/account/verify/:code", get(verify_account))
        .route("/api/account/token/:token", get(token_auth))
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
