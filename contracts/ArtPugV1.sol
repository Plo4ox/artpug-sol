// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ArtPugV1
 * @notice The contract defines an application used to create contests between images.
 * Each entry adds to the reward pool and the winner get all the gains!
 * @dev Main contract used to handle all the ArtPug application interactions.
 * It is an upgradable contract, which means there might be a V2 at some point.
 * This is a first contract for learning purpose, used for the final project at AU.
 */
contract ArtPugV1 is Initializable {

    /** 
     * @dev Price in wei used to know how much 
     * a Contest / Entry creation or participation cost
     */
    struct Price {
        uint participation;
        uint creation;
    }

    /** @dev Vote applied to an entry, the message can be empty */
    struct Vote {
        address owner;
        string message;
    }

    /** 
     * @dev An owner can only have one entry per contest
     * The image must be a valid url toward a real image to be useful
     */
    struct Entry {
        bytes32 id;
        address owner;
        string title;
        string image;
        uint nbVotes;
    }

    /** 
     * @dev A owner can only have one running contest at a time.
     * The prices are set at the contest creation.
     */
    struct Contest {
        uint id;
        address owner;
        string title;
        string banner;
        uint startDate;
        uint endDate;
        Price price;
        uint profits;
        uint reward;
        bool ended;
    }

    /** Owner of the contract */
    address public owner;

    /**
     * Creation and participation price
     * The participation price is used for the reward pool of a contest if the price of the contest is null
     */
    Price public price;

    /** All the profits generated by the app */
    uint public profits;

    /** Mapping of all the votes attached to an Entry */
    mapping(bytes32 => Vote[]) private votes;

    /** Mapping of all the winning entries attached to a Contest */
    mapping(uint => Entry) private winningEntries;

    /** Mapping of all the entries attached to a Contest */
    mapping(uint => Entry[]) private entries;

    /** All the Contests ever created */
    Contest[] private contests;

    /** Emitted when a new contest is created */
    event NewContest(address owner, uint contestId);

    /** Emitted when a new entry is created */
    event NewEntry(address owner, uint contestId, uint entryId);

    /** Emitted when a user has voted on an entry */
    event NewVote(address from, uint contestId, uint entryId);

    /** Emitted when a contest ended */
    event ContestEnded(uint contestId);

    /** Emitted when a contest canceled */
    event ContestCanceled(uint contestId);


    function initialize(uint _participationPrice, uint _creationPrice) public initializer {
        price = Price(_participationPrice, _creationPrice);
        owner = msg.sender;
    }

    function setPrice(uint _participationPrice, uint _creationPrice) external onlyOwner {
        price = Price(_participationPrice, _creationPrice);
    }

    function withdrawProfits() external onlyOwner {
        require(address(this).balance >= profits && profits > 0, "No profits to withdraw!");
        (bool sent, ) = owner.call{value: profits}("");
        require(sent, "Failed to withdraw the profits");
    }

    function voteOn(uint _contestId, uint _entryId, string memory _comment) external {
        require(isContestInProgress(_contestId), "The contest has ended or doesn't exist.");
        Entry memory entry = entries[_contestId][_entryId];
        require(entry.owner != address(0), "The entry doesn't exist.");

        for (uint i = 0; i < votes[entry.id].length; i++) {
            if (votes[entry.id][i].owner == msg.sender) {
                revert("You already voted on this entry");
            }
        }        
        votes[entry.id].push(Vote(msg.sender, _comment));
        entries[_contestId][_entryId].nbVotes += 1;
        emit NewVote(msg.sender, _contestId, _entryId);
    }

    function cancelContest(uint _contestId) external {
        Contest memory contest = contests[_contestId];
        require(msg.sender == contest.owner || msg.sender == owner, "A contest can only be canceled by the contest owner");
        require(contest.ended == false, "The contest profit has already been distributed.");
        require(address(this).balance >= contest.reward + contest.profits, "Insufficient balance to pay the winner");

        // Give back to the participants
        Entry[] memory _entries = entries[_contestId];
        if (_entries.length > 0) {
           for (uint i = 0; i < _entries.length; i++) {
                uint contestPrice = contest.price.creation + contest.price.participation;
                (bool rewarded, ) = _entries[i].owner.call{value: contestPrice}("");
                require(rewarded, "Unable to send the reward to the winner");
            }
        }
        contests[_contestId].ended = true;
        emit ContestCanceled(_contestId);
    }

    function endOutdatedContests() external onlyOwner {
        for (uint i = 0; i < contests.length; i++) {
            if (contests[i].endDate < block.timestamp) {
                endContest(i);
            }
        }
    }

    function endContest(uint _contestId) public {
        Contest memory contest = contests[_contestId];
        require(contest.endDate < block.timestamp, "Contest not over, cancel it instead.");
        require(msg.sender == contest.owner || msg.sender == owner, "A contest can only be ended by the contest owner");
        require(contest.ended == false, "The contest profits have already been distributed.");
        require(address(this).balance >= contest.reward + contest.profits, "Insufficient balance to pay the winner");

        Entry memory winnerEntry;
        Entry[] memory _entries = entries[_contestId];
        if (_entries.length > 0) {
            for (uint i = 0; i < _entries.length; i++) {
                if (winnerEntry.nbVotes < _entries[i].nbVotes) {
                    winnerEntry = _entries[i];
                }
            }
            winningEntries[_contestId] = winnerEntry;

            (bool rewarded, ) = winnerEntry.owner.call{value: contest.reward}("");
            require(rewarded, "Unable to send the reward to the winner");
            if (contest.profits > 0) {
                (bool success, ) = contest.owner.call{value: contest.profits}("");
                require(success, "Unable to send the profits to the contest owner");
            }
        }

        contests[_contestId].ended = true;
        emit ContestEnded(_contestId);
    }

    function isContestInProgress(uint _contestId) public view returns(bool) {
        if (contests[_contestId].ended || contests[_contestId].endDate < block.timestamp) {
            return false;
        }
        return true;
    }

    function getContest(uint _contestId) public view returns(Contest memory) {
        return contests[_contestId];
    }

    function getMyRunningContest() public view returns(Contest memory) {
        for (uint i = 0; i < contests.length; i++) {
            if (contests[i].owner == msg.sender && isContestInProgress(i)) {
                return contests[i];
            }
        }
        revert("No running contests found for the sender.");
    }

    function hasContestInProgress() public view returns(bool) {
        for (uint i = 0; i < contests.length; i++) {
            if (contests[i].owner == msg.sender && isContestInProgress(i)) {
                return true;
            }
        }
        return false;
    }

    function hasEntryInContest(uint _contestId) public view returns(bool) {
        Entry[] memory _entries = entries[_contestId];
        for (uint i = 0; i < _entries.length; i++) {
            if (_entries[i].owner == msg.sender) {
                return true;
            }
        }
        return false;
    }

    function getWinningEntryFor(uint _contestId) external view returns(Entry memory) {
        return winningEntries[_contestId];
    }

    function getAllContests() external view returns(Contest[] memory) {
        return contests;
    }

    function getMyContests() external view returns(Contest[] memory) {
        uint256 myContestCount;
        for (uint i = 0; i < contests.length; i++) {
            if (contests[i].owner == msg.sender) {
                myContestCount++;
            }
        }
        Contest[] memory myContests = new Contest[](myContestCount);
        uint256 j;
        for (uint i = 0; i < contests.length; i++) {
            if (contests[i].owner == msg.sender) {
                myContests[j++] = contests[i];
            }
        }

        return myContests;
    }

    function getEntriesFor(uint _contestId) external view returns(Entry[] memory) {
        return entries[_contestId];
    }

    function hasVotedFor(bytes32 _entryId) external view returns(bool) {
        Vote[] memory entryVotes =  votes[_entryId];
        for (uint i = 0; i < entryVotes.length; i++) {
            if (entryVotes[i].owner == msg.sender) {
                return true;
            }
        }
        return false;
    }

    function addEntry(uint _contestId, string memory _title, string memory _image) external payable {
        Contest memory contest = contests[_contestId];
        require(msg.value >= contest.price.creation + contest.price.participation + price.participation, "Unsificient value provided to participate.");
        require(!hasEntryInContest(_contestId), "You already have an entry in this contest.");
        require(isContestInProgress(_contestId), "This contest is not in progress.");

        contest.profits += contest.price.creation;
        if (contest.price.participation == 0) {
            contests[_contestId].reward += price.participation;
        } else {
            profits += price.participation;
            contests[_contestId].reward += contest.price.participation;
        }
        entries[_contestId].push(
            Entry(
                keccak256(abi.encodePacked(msg.sender,abi.encode(_contestId))),
                msg.sender, 
                _title, 
                _image, 
                0
            )
        );
        emit NewEntry(msg.sender, _contestId, entries[_contestId].length - 1);
    }

    function createContest(
        string memory _title,
        string memory _banner,
        uint _startDate, 
        uint _endDate,
        uint _entryPrice,
        uint _particiationPrice
    ) external payable {
        require(msg.value >= price.creation, "Insufficient value provided to be able to create a contest.");
        if (msg.sender != owner) {
            require(!hasContestInProgress(), "You already have a running contest.");
        }
        require(_startDate < _endDate && _endDate - _startDate >= 1 days, "The duration of a contest must be at least one day.");

        Contest memory contest = Contest(
            contests.length,
            msg.sender,
            _title,
            _banner,
            _startDate,
            _endDate,
            Price(_entryPrice, _particiationPrice),
            0,
            msg.value,
            false
        );
        contests.push(contest);
        emit NewContest(msg.sender, contest.id);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function.");
        _;
    }
}
