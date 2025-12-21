//! This module is used for read and writing the json data used for the overlays and the app
use std::{
    fs::{self, File},
    io::{BufReader, Read},
    path::Path,
};

use serde_json::{json, Value};

use crate::{constants::get_email_config_path, account::email::EmailConfig};

/// Reads the config json and returns the value of the requested key
///
/// # Arguments
/// * `key: &str` - The key to be read from the json file
///
/// # Returns
/// * `String` - The data at the desired key
// pub fn read_client_config_string(key: &str) -> String {
//     read_json(key, &constants::get_client_config_path())
// }

// /// Reads the server config as a `Value` instance
// /// 
// /// # Returns
// /// `Value` - The server's config
// pub fn read_server_config_value() -> Value {
//     read_json_as_value(&constants::get_server_config_path())
// }

/// Reads the json at the supplied path and returns the value of the requested key
///
/// # Arguments
/// * `key: &str` - The key to be read from the json file
/// * `path: String` - The path to the json file
///
/// #Returns
/// * 'String' - The data at the desired key

pub fn read_json(key: &str, path: &str) -> String {
    let json_data: Value = open_json(path);

    read_json_from_buf(key, &json_data)
}

pub fn read_json_as_value(path: &str) -> Value {
    open_json(path).clone()
}

pub fn read_json_from_buf(key: &str, json: &Value) -> String {
    json.get(key).unwrap().as_str().unwrap().to_string()
}

/// Opens the json file with the supplied path
///
/// # Arguments
/// * `path: String` - The path to the JSON file to read
///
/// # Returns
/// * `Value` - Contains the JSON data
///
/// # Examples
/// ```ignore
/// open_json("random_path/config.json");
/// ```
fn open_json(path: &str) -> Value {
    let json_data: Value;

    // Checks to make sure that the JSON file is there, if it isn't it makes it
    if Path::new(&path).exists() {
        let mut reader: BufReader<File> = BufReader::new(File::open(&path).unwrap());

        let mut buffer: Vec<u8> = Vec::new();

        reader
            .read_to_end(&mut buffer)
            .map_err(|e| e.to_string())
            .unwrap();

        // If the file is a "Resource Not Found" file, return a blank vector
        if buffer.len() == 0 {
            return Value::default();
        }

        json_data = {
            let file_content: String = fs::read_to_string(&path).expect("File not found");
            serde_json::from_str::<Value>(&file_content).expect("Error serializing to JSON")
        };
    } else {
        json_data = init_json(path);
    }

    // Returns the json data
    json_data
}

/// This function is called if the JSON being read doesn't exist
///
/// It after making the file it will try to read the file and then return that value
///
/// # Arguments
/// * `path: String` - The path to the JSON file to read
///
/// # Returns
/// * `Value` - Contains the JSON data
pub fn init_json(path: &str) -> Value {
    // Creating the directories
    let _ = std::fs::create_dir_all(Path::new(&path).parent().unwrap());

    // Initializes the json_data variable
    // let json_data: Value = if path.contains("email-config.json") {
    let json_data = get_default_email_config();

    // Creating the JSON file
    fs::write(
        &path,
        serde_json::to_string_pretty(&json_data).expect(
            "Error 
    serializing to JSON",
        ),
    )
    .expect("Error writing file");

    // Trying to open the JSON again
    open_json(path)
}

/// Writes to the JSON file at the supplied path
///
/// # Arguments
/// * `path: String` - Path to the JSON file
/// * `json_key: String` - Key to write to
/// * `value: String` ` Value to write to the key`
///
/// # Examples
/// ```ignore
/// write_json("random_path/config.json", "profile", "NewProfile");
/// ```

pub fn write_json(path: &str, json_key: &str, value: Value) {
    // Cloning the data because a borrow won't work in this case
    let mut json_data = open_json(path);

    json_data[json_key] = value;

    fs::write(
        path,
        serde_json::to_string_pretty(&json_data).expect("Error serializing to JSON"),
    )
    .expect("Error writing file");
}

/// Write to a file from a JSON value
pub fn write_json_from_value(path: &str, json: Value) {
    fs::write(
        path,
        serde_json::to_string_pretty(&json).expect("Error serializing to json"),
    )
    .expect("Failed to write to file.");
}

/// Recursively reads a JSON value and writes a new value to the specified key path.
/// No IO means it won't write to file system
///
/// # Arguments
/// * `json` - The JSON value to be modified.
/// * `keys` - A dot-separated string path specifying the keys/indexes to traverse. Array indices should be wrapped in square brackets, `arrayKey[0].nestedKey`.
/// * `value` - The new value to write at the final key.
///
/// # Returns
/// * `Value` - The modified JSON with the new value inserted.
///
/// # Example
/// ```ignore
/// use serde_json::{json, Value};
///
/// let json = json!({"key": [{"nestedKey": "oldValue"}]});
///
/// let value = Value::String("newValue".to_string());
///
/// let new_json = write_nested_json_no_io(json, "key[0].nestedKey".to_string(), value);
///
/// assert_eq!(new_json, json!({"key": [{"nestedKey": "newValue"}]}));
/// ```
pub fn write_nested_json_no_io(mut json: Value, keys: String, value: Value) -> Value {
    // Makes the key variable to keep track of characters
    let mut key = String::new();

    // Iterates through every char while keeping track of the index
    for (i, char) in keys.chars().enumerate() {
        match char {
            // If char is a '.', set json[key] equal to the next nested key
            '.' => {
                json[key] = write_nested_json_no_io(
                    json[&key].clone(),
                    keys.clone().split_at(i + 1).1.to_owned(),
                    value,
                );
                break;
            }
            // If char is a '['
            '[' => {
                // Get the char from the string as a usize
                let mut key = String::new();

                for char in keys.get(i..).unwrap().chars() {
                    if char != ']' {
                        key.push(char);
                    } else if char == ']' {
                        break;
                    }
                }

                let i_key = keys.get(i + 1..i + 2).unwrap().parse::<usize>().unwrap();

                // If the key doesn't exist, push the value and set the json equal to the new Vec
                if json.as_array().unwrap().len() == 0 || json.as_array().unwrap().len() - 1 < i_key
                {
                    let mut json_vec = json.as_array().unwrap().to_owned();

                    json_vec.push(value);

                    json = Value::Array(json_vec);
                } else {
                    // If the key exists, set it equal to the next nested value
                    json[i_key] = write_nested_json_no_io(
                        json[i_key].clone(),
                        keys.clone().split_at(i + 3).1.to_owned(),
                        value,
                    );
                }

                // Escape the loop
                break;
            }
            // If char is a ']' do nothing
            ']' => (),
            // If char is anything else, add it to the key
            _ => key.push(char),
        }

        // If i is the last character, or if the next character is ']' and i is the second to last character
        // Write the inputted value to the json
        if i == keys.len() - 1
            || (keys.get(i..i + 1).unwrap() == "]".to_string() && i == keys.len() - 2)
        {
            json[key.clone()] = value.clone();
        }
    }

    // Returns the json object
    json
}

/// Writes to the config json
///
/// # Arguments
/// * `json_key: &str` - Key to write to
/// * `value: &str` - Value to write to the key
// pub fn write_client_config(json_key: &str, value: Value) {
//     write_json(
//         &constants::get_client_config_path(),
//         json_key,
//         value,
//     );
// }

/// Writes to the server json
/// 
/// # Arguments
/// * `json_key: &str` - Key to write to
/// * `value: &str` - Value to write to the key
// pub fn write_server_config(json_key: &str, value: Value) {
//     write_json(&constants::get_server_config_path(), json_key, value);
// }

// /// Writes to the server config using a whole JSON value
// /// 
// /// # Arguments
// /// * `value: Value` - Configuration to set the whole config to
// pub fn write_server_config_all(value: Value) {
//     fs::write(
//         &constants::get_server_config_path(),
//         serde_json::to_string_pretty(&value).expect("Error serializing to JSON"),
//     )
//     .expect("Error writing file");
// }

/// Iterate over a json object and return a Vec of key values
///
/// # Arguments
/// * `json_key: &str` - Key to search for
/// * `json: &Value` - Reference to json object to be search
///
/// # Returns
/// 'Vec<String>' Contains all the found values
pub fn iterate_json(json_key: &str, json: &Value) -> Vec<String> {
    let mut entries: Vec<String> = Vec::new();

    if json.is_array() {
        for value in json.as_array().unwrap().to_vec() {
            for v in iterate_json_map(json_key, &value) {
                entries.push(v);
            }
        }
    } else {
        for v in iterate_json_map(json_key, json) {
            entries.push(v);
        }
    }

    entries
}

/// Iterates over a json object
///
/// # Arguments
/// * `json_key`: &str` - Key to search for
/// * `json: &Value` - Reference to json object to be searched
///
/// # Returns
/// `Vec<String>` Contains all the found values
fn iterate_json_map(json_key: &str, json: &Value) -> Vec<String> {
    let mut entries: Vec<String> = Vec::new();

    for value in json.as_object().unwrap() {
        let (key, v) = value;
        if key == json_key {
            entries.push(v.to_string().replace("\"", ""));
        } else if v.is_object() {
            for val in iterate_json(json_key, &v) {
                entries.push(val);
            }
        }
    }

    entries
}

/// Counts the length of a json object
///
/// # Arguments
/// * `json: &Value` - JSON to be searched
///
/// # Returns
/// * `u32` The length of the json
pub fn get_json_length(json: &Value) -> u32 {
    let mut size: u32 = 0;

    if json.is_array() {
        for v in json.as_array().unwrap().to_vec() {
            for _ in v.as_object().unwrap() {
                size += 1;
            }
        }
    } else {
        for _ in json.as_object().unwrap() {
            size += 1;
        }
    }

    size
}

pub fn get_email_config() -> EmailConfig {
    read_json_as_value(&get_email_config_path()).to_email_config()
}

/// Resets the client config
// pub fn reset_client_config() {
//     let default_json = get_default_client_json_data();
    
//     write_json_from_value(&get_client_config_path(), default_json);
// }

// /// Resets the server config
// pub fn reset_server_config() {
//     let default_json = get_default_server_json_data();
    
//     write_json_from_value(&get_server_config_path(), default_json);
// }

/// Default settings for the email config
fn get_default_email_config() -> Value {
    json!({
        "emailAddress": "me@example.com",
        "username": "me@example.com",
        "emailPassword": "1243124231",
        "emailSMTPHost": "smtp.example.com",
        "emailSMTPPort": 465,
    })

}

trait ToEmailConfig {
    fn to_email_config(&self) -> EmailConfig;
}

impl ToEmailConfig for serde_json::Value {
    fn to_email_config(&self) -> EmailConfig {
        // Extract each field from the JSON value, providing defaults if necessary
        let email_address = self.get("emailAddress").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let username = self.get("username").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let email_password = self.get("emailPassword").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let email_smtp_host = self.get("emailSMTPHost").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let email_smtp_port = self.get("emailSMTPPort").and_then(|v| v.as_u64()).unwrap_or(587) as u16;
        
        EmailConfig::new(
            email_address,
            username,
            email_password,
            email_smtp_host,
            email_smtp_port,
        )
    }
}
