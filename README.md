# ⚽ Ballerz ⚽
Ballerz is a NFT project that serves as the basis of the Ballerz football management on-chain sim game. 
Here we will describe the abstractions and functional implementation details that can be found in this repository 
## Abstractions
#### Player 🤾‍♂️
The central abstraction in the Ballerz universe is the **Player** should model a football (Soccer) player, A player has a first and last name, a contract nationality, and a stats object which will be described below. A logical represtation of a player can be thought of as:

`{
	firstname:string,
	surname:string,
	nationality:address
	stats:StatsObject
    postion:PositionEnum
}`

#### Stats
