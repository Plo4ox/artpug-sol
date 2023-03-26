const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect, assert } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ArtPugV1", () => {
    async function deployContractAndSetVariables() {
        const [_owner, _anotherAccount, _thirdAccount] = await ethers.getSigners();
        const ArtPugV1 = await ethers.getContractFactory("ArtPugV1");
        const _artPug = await upgrades.deployProxy(ArtPugV1, [toEther("6"), toEther("3")]);
        await _artPug.deployed();
        return { _artPug, _owner, _anotherAccount, _thirdAccount };
    }

    describe("After initialization", () => {
        let artPug;
        before(async () => {
            const { _artPug } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug
        });

        it("must have the right price", async () => {
            const price = await artPug.price();
            expect(await ethers.utils.formatEther(price.participation)).to.equal("6.0"); 
            expect(await ethers.utils.formatEther(price.creation)).to.equal("3.0"); 
        });
    });


    describe("Updating the contract price", () => {
        let artPug, owner, anotherAccount;
        before(async () => {
            const { _artPug, _owner, _anotherAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            owner = _owner;
            anotherAccount = _anotherAccount;
        });

        it("with owner, must have the right price", async () => {
            await artPug.connect(owner).setPrice(toEther("3"), toEther("6"));

            const price = await artPug.price();
            expect(await ethers.utils.formatEther(price.participation)).to.equal("3.0"); 
            expect(await ethers.utils.formatEther(price.creation)).to.equal("6.0"); 
        });

        it("without owner, must revert", async () => {
            await expect(artPug.connect(anotherAccount).setPrice(toEther("3"), toEther("6"))).to.be.reverted;
        });
    });


    describe("When withdrawing profits", () => {
        let artPug, owner, anotherAccount;
        before(async () => {
            const { _artPug, _owner, _anotherAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            owner = _owner;
            anotherAccount = _anotherAccount;

            await artPug.connect(anotherAccount).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )
        });

        it("without the owner, must revert", async () => {
            await expect(artPug.connect(anotherAccount).withdrawProfits()).to.be.reverted
        });

        it("with the owner, and no profits, must revert", async () => {
            await expect(artPug.connect(owner).withdrawProfits()).to.be.reverted
        });

        it("with the owner, and profits, must be sent to the owner", async () => {
            await artPug.connect(anotherAccount).addEntry(
                0,
                "myEntry",
                "myEntryUrl",
                { value: toEther("15") }
            )

            await artPug.connect(owner).withdrawProfits();
            const balance = await ethers.provider.getBalance(owner.address);
            expect("10005.988471840702397823").to.equal(
                await ethers.utils.formatEther(balance)
            ); 
        });
    });


    describe("When voting on an entry", () => {
        let artPug, owner, anotherAccount;
        before(async () => {
            const { _artPug, _owner, _anotherAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            owner = _owner;
            anotherAccount = _anotherAccount;

            await artPug.connect(anotherAccount).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )
            await artPug.connect(owner).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )
            await artPug.connect(anotherAccount).addEntry(
                1,
                "title", 
                "imageUrl",
                { value: toEther("15") }
            );
            await artPug.connect(anotherAccount).addEntry(
                0,
                "title", 
                "imageUrl",
                { value: toEther("15") }
            );
            await artPug.connect(owner).cancelContest(1);
        });

        it("that doesn't exist, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).voteOn(0, 123, "A comment")
            ).to.be.reverted;
        });

        it("attached to a closed contest, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).voteOn(1, 0, "A comment")
            ).to.be.reverted;
        });

        it("attached to a running contest, must validate the vote", async () => {
            const tx = await artPug.connect(anotherAccount).voteOn(0, 0, "A comment");
            const receipt = await tx.wait();
            assert.equal(receipt.events[0].event, "NewVote");
            assert.equal(receipt.events[0].args.from, anotherAccount.address);
            assert.equal(receipt.events[0].args.contestId, 0n);
            assert.equal(receipt.events[0].args.entryId, 0n);
        });

        it("already voted, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).voteOn(0, 0, "A comment")
            ).to.be.reverted;
        });
    });


    describe("When cancelling a contest", () => {
        let artPug, owner, anotherAccount;
        before(async () => {
            const { _artPug, _owner, _anotherAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            owner = _owner;
            anotherAccount = _anotherAccount;

            await artPug.connect(anotherAccount).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )
            await artPug.connect(owner).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )

            await artPug.connect(owner).addEntry(
                0,
                "title", 
                "imageUrl",
                { value: toEther("15") }
            );
        });

        it("not the owner or the contest, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).cancelContest(1)
            ).to.be.reverted;
        });

        it("cancel contest with owner, must revert", async () => {
            const tx = await artPug.connect(anotherAccount).cancelContest(0);
            const receipt = await tx.wait();

            assert.equal(receipt.events[0].event, "ContestCanceled");
            assert.equal(receipt.events[0].args.contestId, 0n);
            const balance = await ethers.provider.getBalance(owner.address);
            expect("9987.987887317310992051").to.equal(
                await ethers.utils.formatEther(balance)
            ); 
        });
    });


    describe("When closing outdated contest", () => {
        let artPug, owner, anotherAccount, thirdAccount, endDate;
        before(async () => {
            const { _artPug, _owner, _anotherAccount, _thirdAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            owner = _owner;
            anotherAccount = _anotherAccount;
            thirdAccount = _thirdAccount;

            await artPug.connect(anotherAccount).createContest(
                "title",
                "url",
                beforeNow,
                now,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )
            await artPug.connect(owner).createContest(
                "title",
                "url",
                beforeNow,
                now,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            )
            await artPug.connect(thirdAccount).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            );
        });

        it("not owner tries to end all outdated contests, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).endOutdatedContests()
            ).to.be.reverted;
        });

        it("owner ends all outdated contests", async () => {
            const tx = await artPug.connect(owner).endOutdatedContests();
            const receipt = await tx.wait();

            assert.equal(receipt.events[0].event, "ContestEnded");
            assert.equal(receipt.events[1].event, "ContestEnded");
            assert.equal(receipt.events[0].args.contestId, 0n);
            assert.equal(receipt.events[1].args.contestId, 1n);  
        });
    });


    describe("When adding a new entry", () => {
        let artPug, owner, anotherAccount;
        before(async () => {
            const { _artPug, _owner, _anotherAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            owner = _owner;
            anotherAccount = _anotherAccount;

            await artPug.connect(anotherAccount).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            );
            await artPug.connect(owner).createContest(
                "title",
                "url",
                beforeNow,
                now,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            );
        });

        it("on an outdated contest, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).addEntry(
                    1,
                    "title", 
                    "imageUrl",
                    { value: toEther("15") }
                )
            ).to.be.reverted;
        });

        it("without sufficient funds, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).addEntry(
                    0,
                    "title", 
                    "imageUrl",
                    { value: toEther("5") }
                )
            ).to.be.reverted;
        });

        it("on a valid contest", async () => {
            const tx = await artPug.connect(anotherAccount).addEntry(
                0,
                "title", 
                "imageUrl",
                { value: toEther("15") }
            );
            const receipt = await tx.wait();

            assert.equal(receipt.events[0].event, "NewEntry");
            assert.equal(receipt.events[0].args.contestId, 0n);
            assert.equal(receipt.events[0].args.entryId, 0n);

            const ownerBalance = await ethers.provider.getBalance(owner.address);
            expect("9993.988191726446491692").to.equal(
                await ethers.utils.formatEther(ownerBalance)
            );
            const anotherAccountBalance = await ethers.provider.getBalance(anotherAccount.address);
            expect("9978.999136980423604622").to.equal(
                await ethers.utils.formatEther(anotherAccountBalance)
            );  
        });
    });


    describe("When creating a contest", () => {
        let artPug, anotherAccount;
        before(async () => {
            const { _artPug, _anotherAccount } = await loadFixture(deployContractAndSetVariables);
            artPug = _artPug;
            anotherAccount = _anotherAccount;
        });
        it("with insufficient value, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).createContest(
                    "title",
                    "url",
                    86400,
                    172801,
                    toEther("3"),
                    toEther("6"),
                    { value: 1 }
                )
            ).to.be.reverted
        });

        it("with end date in the past, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).createContest(
                    "title",
                    "url",
                    172801,
                    86400,
                    toEther("3"),
                    toEther("6"),
                    { value: toEther("6") }
                )
            ).to.be.reverted
        });

        it("with end date in less than one day, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).createContest(
                    "title",
                    "url",
                    86400,
                    90400,
                    toEther("3"),
                    toEther("6"),
                    { value: toEther("6") }
                )
            ).to.be.reverted
        });

        it("create new contest", async () => {
            const tx = await artPug.connect(anotherAccount).createContest(
                "title",
                "url",
                now,
                afterNow,
                toEther("3"),
                toEther("6"),
                { value: toEther("6") }
            );
            const receipt = await tx.wait();
            assert.equal(receipt.events[0].event, "NewContest");
            assert.equal(receipt.events[0].args.contestId, 0n);
            assert.equal(receipt.events[0].args.owner, anotherAccount.address);
        });

        it("with an already existing contest, must revert", async () => {
            await expect(
                artPug.connect(anotherAccount).createContest(
                    "title2",
                    "url2",
                    now,
                    afterNow,
                    toEther("3"),
                    toEther("6"),
                    { value: toEther("6") }
                )
            ).to.be.reverted
        });
    });
});


// TOOLS

function toEther(number) {
    return ethers.utils.parseUnits(number, "ether");
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

const beforeNow = (new Date().getTime() / 1000).toFixed(0) - 172801;
const now = (new Date().getTime() / 1000).toFixed(0);
const afterNow = (new Date().getTime() / 1000).toFixed(0) + 172801;
