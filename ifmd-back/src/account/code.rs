#[derive(sqlx::FromRow, Clone, Debug, serde::Serialize, serde::Deserialize, sqlx::Decode, sqlx::Encode)]
pub struct Code {
    /// Code to be used to search the database
    pub code: String,
    /// Action to perform once the code is found
    pub action: String,
    /// Data to use for the action
    pub data: String
}

impl Code {
    pub fn parse_id(&self) -> String {
        let arguments = self.parse_data();

        for arg in arguments {
            if arg.contains("id") {
                // Unwrap as the server is generating the args
                let key_break = arg.find(":").unwrap();

                return arg[key_break+1..].to_string();
            }
        }

        "".to_string()
    }

    fn parse_data(&self) -> Vec<String> {
        let mut arguments: Vec<String> = Vec::new();

        let mut data = self.data.clone();

        loop {
            let delimiter_pos = data.find(",");

            if delimiter_pos.is_none() {
                break;
            }

            let delimiter_pos = delimiter_pos.unwrap();

            arguments.push(data[0..delimiter_pos].to_string());

            data = data[(delimiter_pos+1)..].to_owned();
        }

        arguments
    }

    /// Makes a new Code
    pub fn new(code: &str, action: Action, data: &str) -> Code {
        Code {
            code: code.to_string(),
            action: action.to_string(),
            data: data.to_string()
        }
    } 
}

pub enum Action {
    VERIFY
}

impl Action {
    /// Convert the Action to a String
    fn to_string(&self) -> String {
        let val = match self {
            Action::VERIFY => "VERIFY"
        };

        val.to_string()
    }
}