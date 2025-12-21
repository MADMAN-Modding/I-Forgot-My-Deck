use core::fmt;

use email_address_parser::EmailAddress;
use lettre::{Message, SmtpTransport, Transport, message::header::ContentType, transport::smtp::authentication::Credentials};

/// Configuration structure for the application
/// Holds email settings, recipient info, check interval, and IP address.
/// 
/// Fields
/// * `email_address`: The email address used to send notifications.
/// * `email_password`: The password or app-specific password for the email account.
/// * `email_smtp_host`: The SMTP host for the email service.
/// * `email_smtp_port`: The SMTP port for the email service.
#[derive(Clone, Debug)]
pub struct EmailConfig {
    /// The email address used to send notifications.
    pub email_address: String,
    /// The username to authenticate with (often the same as the email_address)
    pub username: String,
    /// The password or app-specific password for the email account.
    pub email_password: String,
    /// The SMTP host for the email service.
    pub email_smtp_host: String,
    /// The SMTP port for the email service.
    pub email_smtp_port: u16,
}

impl EmailConfig {
    /// Creates a new `Config` instance with the provided parameters.
    /// The `ip_address` field is initialized to an empty string.
    /// # Parameters
    /// * `email_address`: The email address used to send notifications.
    /// * `email_password`: The password or app-specific password for the email account.
    /// * `email_smtp_host`: The SMTP host for the email service.
    /// * `email_smtp_port`: The SMTP port for the email service.
    /// * `recipient_address`: The email address of the recipient who will receive notifications.
    /// * `check_interval_minutes`: The interval in minutes to check for IP changes.
    /// * `ip_address`: The last known IP address.
    /// # Returns
    /// * `Config` - A new instance of the `Config` struct.
    pub fn new(
        email_address: String,
        username: String,
        email_password: String,
        email_smtp_host: String,
        email_smtp_port: u16,
    ) -> Self {
        EmailConfig {
            email_address,
            username,
            email_password,
            email_smtp_host,
            email_smtp_port,
        }
    }

    /// Prints the configuration details to the console for debugging purposes.
    pub fn print(&self) {
        println!("Email Address: {}", self.email_address);
        println!("Username: {}", self.username);
        println!("Email Password: {}", self.email_password);
        println!("SMTP Host: {}", self.email_smtp_host);
        println!("SMTP Port: {}", self.email_smtp_port);
    }

    /// Converts the `Config` instance to a JSON value.
    /// # Returns
    /// * `serde_json::Value` - A JSON representation of the `Config` instance
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "emailAddress": self.email_address,
            "username": self.username,
            "emailPassword": self.email_password,
            "emailSMTPHost": self.email_smtp_host,
            "emailSMTPPort": self.email_smtp_port,
        })
    }
}

/// Implement Display trait for Card
impl fmt::Display for EmailConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}\n{}\n{}\n{}\n", self.email_address, self.username, self.email_smtp_host, self.email_smtp_port)
    }
}

pub fn send_email(
    config: &EmailConfig,
    message: &str,
    recipient: &str
) -> std::result::Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Define the email
    let email = Message::builder()
        .from(
            format!("I Forgot My Deck <{}>", config.email_address)
                .parse()
                .unwrap_or_else(|_| return "I Forgot My Deck <unknown@example.com>".parse().unwrap()),
        )
        .to(format!("{}", recipient).parse().unwrap())
        .subject("Welcome to I Forgot My Deck")
        .header(ContentType::TEXT_HTML)
        .body(format!("{}", message))
        .unwrap();

    // Set up the SMTP client
    let creds = Credentials::new(config.username.to_owned(), config.email_password.to_owned());

    // Open a remote connection to gmail
    let mailer = SmtpTransport::relay(&config.email_smtp_host)?
        .port(config.email_smtp_port)
        .credentials(creds)
        .build();

    // Send the email
    match mailer.send(&email) {
        Ok(_) => {},
        Err(e) => eprintln!("Could not send email: {:?}", e),
    };
    Ok(())
}


pub fn validate_email(email: &str) -> bool {
    EmailAddress::is_valid(email, None)
}