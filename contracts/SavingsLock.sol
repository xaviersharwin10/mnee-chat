// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SavingsLock
 * @notice Lock tokens for a specified duration - enforced on-chain savings
 * @dev Users can create time-locked deposits that can only be withdrawn after the lock expires
 */
contract SavingsLock is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        uint256 id;
        address owner;
        uint256 amount;
        uint256 unlockTime;
        bool withdrawn;
        string note;
    }

    IERC20 public immutable token;
    uint256 public nextLockId;
    
    mapping(uint256 => Lock) public locks;
    mapping(address => uint256[]) public locksByOwner;

    event LockCreated(
        uint256 indexed id,
        address indexed owner,
        uint256 amount,
        uint256 unlockTime,
        string note
    );
    
    event LockWithdrawn(
        uint256 indexed id,
        address indexed owner,
        uint256 amount
    );

    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        nextLockId = 1;
    }

    /**
     * @notice Create a time-locked deposit
     * @param amount Amount to lock (in token decimals)
     * @param durationSeconds How long to lock (in seconds)
     * @param note Optional description
     */
    function createLock(
        uint256 amount,
        uint256 durationSeconds,
        string calldata note
    ) external returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        require(durationSeconds >= 60, "Minimum lock is 1 minute"); // Min 1 minute for testing
        require(durationSeconds <= 365 days, "Maximum lock is 1 year");

        uint256 lockId = nextLockId++;
        uint256 unlockTime = block.timestamp + durationSeconds;
        
        locks[lockId] = Lock({
            id: lockId,
            owner: msg.sender,
            amount: amount,
            unlockTime: unlockTime,
            withdrawn: false,
            note: note
        });

        locksByOwner[msg.sender].push(lockId);

        // Transfer tokens from user to contract
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit LockCreated(lockId, msg.sender, amount, unlockTime, note);
        
        return lockId;
    }

    /**
     * @notice Withdraw a lock after it expires
     * @param lockId ID of the lock to withdraw
     */
    function withdraw(uint256 lockId) external nonReentrant {
        Lock storage lock = locks[lockId];
        
        require(lock.id != 0, "Lock does not exist");
        require(lock.owner == msg.sender, "Not the lock owner");
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp >= lock.unlockTime, "Lock not expired yet");

        lock.withdrawn = true;

        // Transfer tokens back to owner
        token.safeTransfer(msg.sender, lock.amount);

        emit LockWithdrawn(lockId, msg.sender, lock.amount);
    }

    /**
     * @notice Get lock details
     */
    function getLock(uint256 lockId) external view returns (Lock memory) {
        return locks[lockId];
    }

    /**
     * @notice Get all lock IDs for a user
     */
    function getLocksByOwner(address owner) external view returns (uint256[] memory) {
        return locksByOwner[owner];
    }

    /**
     * @notice Get active (not withdrawn) locks for a user
     */
    function getActiveLocks(address owner) external view returns (Lock[] memory) {
        uint256[] memory ids = locksByOwner[owner];
        uint256 activeCount = 0;
        
        // Count active
        for (uint256 i = 0; i < ids.length; i++) {
            if (!locks[ids[i]].withdrawn) {
                activeCount++;
            }
        }
        
        // Build array
        Lock[] memory active = new Lock[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (!locks[ids[i]].withdrawn) {
                active[idx++] = locks[ids[i]];
            }
        }
        
        return active;
    }

    /**
     * @notice Check if a lock can be withdrawn
     */
    function canWithdraw(uint256 lockId) external view returns (bool) {
        Lock memory lock = locks[lockId];
        return lock.id != 0 && !lock.withdrawn && block.timestamp >= lock.unlockTime;
    }

    /**
     * @notice Get remaining time until unlock (in seconds)
     */
    function getTimeRemaining(uint256 lockId) external view returns (uint256) {
        Lock memory lock = locks[lockId];
        if (lock.id == 0 || lock.withdrawn || block.timestamp >= lock.unlockTime) {
            return 0;
        }
        return lock.unlockTime - block.timestamp;
    }
}
