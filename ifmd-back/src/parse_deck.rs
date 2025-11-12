pub fn read_deck_file(path: &str) -> Result<(), anyhow::Error>{
    let cards = std::fs::read_to_string(path)?;
    
    let mut cards_vec: Vec<String> = Vec::new();

    // Filter out numbers and space before card names
    for line in cards.lines() {
        let card_name = line.trim_start().splitn(2, ' ').nth(1).unwrap_or(line);
        println!("{}", card_name);
        cards_vec.push(card_name.to_string());
    }

    let mut filtered_cards_vec: Vec<String> = Vec::new();

    // Filter out collector numbers at the end of card names
    for card in cards_vec {
        let card_name = card.split(')').next().unwrap_or(&card).trim().to_owned() + ")";
        println!("{}", card_name);
        filtered_cards_vec.push(card_name);
    }
    Ok(())
}