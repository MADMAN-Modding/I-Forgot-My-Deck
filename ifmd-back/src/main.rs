use axum::{Router, routing::get};
use axum_server::tls_rustls::RustlsConfig;
use ifmd_back::{
    constants, database,
    routes::{
        accounts::{auth_account, make_account, token_auth, verify_account},
        cards::get_card_by_exact_name,
        decks::{add_deck, delete_deck, get_deck_list, get_user_decks},
        lobby::{create_lobby, ws_handler, ws_handler_auth, ws_waiting_handler},
    },
    state,
};
use tower_http::cors::CorsLayer;

use std::{net::SocketAddr, sync::Arc};

#[tokio::main]
async fn main() {
    constants::setup();

    let db = database::start_db().await;

    let app_state = Arc::new(state::AppState::new(db.clone()));

    // Spawn queue thread
    let state_clone = app_state.clone();
    tokio::spawn(async move {
        ifmd_back::queue::manage_queue(state_clone).await;
    });

    tokio::spawn(async move {
        ifmd_back::db_cleaner::run_clean(db).await;
    });

    // Define your router
    let app = Router::new()
        .route(
            "/api/card/name/{card_name}/{card_set}",
            get(get_card_by_exact_name),
        )
        .route(
            "/api/account/create/{display_name}/{id}/{email}/{password}",
            get(make_account),
        )
        .route("/api/account/auth/{id}/{password}", get(auth_account))
        .route("/api/account/verify/{code}", get(verify_account))
        .route("/api/account/token/{token}", get(token_auth))
        .route("/api/decks/add/{deck}/{name}/{token}", get(add_deck))
        .route("/api/decks/get/{token}", get(get_user_decks))
        .route("/api/deck_list/get/{token}/{id}", get(get_deck_list))
        .route("/api/decks/delete/{token}/{id}", get(delete_deck))
        .route("/ws/join/{lobby_id}/{client_type}", get(ws_handler))
        .route(
            "/ws/join/{lobby_id}/{client_type}/{token}",
            get(ws_handler_auth),
        )
        .route("/ws/waiting/{lobby_id}/{token}", get(ws_waiting_handler))
        .route("/api/lobby/create/{lobby_id}/{token}", get(create_lobby))
        .layer(CorsLayer::permissive())
        .with_state(app_state.clone());

    let config = RustlsConfig::from_pem_file("certs/crt.pem", "certs/priv_key.pem")
        .await
        .unwrap();

    // Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {addr}");

    if cfg!(debug_assertions) {
        axum_server::bind_rustls(addr, config)
            .serve(app.into_make_service())
            .await
            .unwrap();
    } else {
        axum_server::bind(addr)
            .serve(app.into_make_service())
            .await
            .unwrap();
    }
}
