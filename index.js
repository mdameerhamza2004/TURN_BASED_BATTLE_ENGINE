// A simple, browser-compatible game engine

// 1. Define the characters
const player = {
    name: "Hero",
    hp: 100,
    attackPower: 15,
    isAlive: true
};

const enemy = {
    name: "Goblin",
    hp: 80,
    attackPower: 10,
    isAlive: true
};

// 2. Function to handle an attack
function performAttack(attacker, defender) {
    // Announce the attack
    console.log(`--- ${attacker.name} attacks ${defender.name}! ---`);
    
    // Calculate damage with a little randomness
    const damage = Math.floor(Math.random() * attacker.attackPower) + 1;
    defender.hp -= damage;

    // Check if the defender is defeated
    if (defender.hp <= 0) {
        defender.hp = 0;
        defender.isAlive = false;
        console.log(`${defender.name} takes ${damage} damage and has been defeated!`);
    } else {
        console.log(`${defender.name} takes ${damage} damage and has ${defender.hp} HP left.`);
    }
    console.log(" "); // Add a blank line for readability
}

// 3. The Main Game Loop
function startGame() {
    console.log("Battle Start!");
    console.log(`${player.name} (HP: ${player.hp}) vs. ${enemy.name} (HP: ${enemy.hp})`);
    console.log("======================================");

    // Loop continues as long as both are alive
    while (player.isAlive && enemy.isAlive) {
        // Player's Turn
        performAttack(player, enemy);
        if (!enemy.isAlive) break; // Check for win condition after player's attack

        // Enemy's Turn
        performAttack(enemy, player);
    }

    // 4. Announce the final result
    console.log("======================================");
    if (player.isAlive) {
        console.log("Congratulations! You have won the battle!");
    } else {
        console.log("You have been defeated. GAME OVER.");
    }
}

// 5. Start the game!
startGame();
