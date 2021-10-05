const {catchRevert} = require("./exceptions");

const Ballerz = artifacts.require("Ballerz");

contract("Ballerz", accounts => {
    it("should add player to global registry when create called", async () => {
        const instance = await Ballerz.deployed();
        const transaction = await instance.createPlayer("Eduardo", "Ghendalfi", accounts[0], 0);
        const player = await instance.getPlayer(accounts[0]);
        console.log(player);
        assert.equal(player.firstName, "Eduardo");
        assert.equal(player.lastName, "Ghendalfi");
        assert.equal(player.nationality, accounts[0]);
    }


    )

    it("should only allow owner to assign position on createPlayer", async () => {
        const instance = await Ballerz.deployed();
        await catchRevert(instance.createPlayer("Eduardo", "Ghendalfi", accounts[0], 0, {from: accounts[1]}));
        const player = await instance.getPlayer(accounts[0]);
        console.log(player);
    }

    )
}
);