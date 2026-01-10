// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ScheduledPayment
 * @notice Create recurring payments that execute on a schedule
 * @dev Requires off-chain keeper/cron to trigger executePayment
 */
contract ScheduledPayment is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Schedule {
        uint256 id;
        address sender;
        address recipient;
        uint256 amount;
        uint256 intervalSeconds;  // Time between payments
        uint256 nextPaymentTime;  // When next payment is due
        uint256 remainingPayments; // 0 = unlimited
        bool active;
        string note;
    }

    IERC20 public immutable token;
    uint256 public nextScheduleId;
    
    mapping(uint256 => Schedule) public schedules;
    mapping(address => uint256[]) public schedulesBySender;
    mapping(address => uint256[]) public schedulesByRecipient;

    event ScheduleCreated(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 intervalSeconds,
        string note
    );
    
    event PaymentExecuted(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 amount
    );
    
    event ScheduleCancelled(uint256 indexed id, address indexed sender);

    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        nextScheduleId = 1;
    }

    /**
     * @notice Create a scheduled payment
     * @param recipient Who receives the payments
     * @param amount Amount per payment
     * @param intervalSeconds Time between payments (e.g., 86400 for daily)
     * @param numPayments Number of payments (0 = unlimited)
     * @param note Description
     */
    function createSchedule(
        address recipient,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 numPayments,
        string calldata note
    ) external returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(recipient != msg.sender, "Cannot schedule to yourself");
        require(amount > 0, "Amount must be > 0");
        require(intervalSeconds >= 60, "Minimum interval is 1 minute");

        uint256 scheduleId = nextScheduleId++;
        
        schedules[scheduleId] = Schedule({
            id: scheduleId,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            intervalSeconds: intervalSeconds,
            nextPaymentTime: block.timestamp, // First payment can execute immediately
            remainingPayments: numPayments,
            active: true,
            note: note
        });

        schedulesBySender[msg.sender].push(scheduleId);
        schedulesByRecipient[recipient].push(scheduleId);

        emit ScheduleCreated(scheduleId, msg.sender, recipient, amount, intervalSeconds, note);
        
        return scheduleId;
    }

    /**
     * @notice Execute a scheduled payment (can be called by anyone)
     * @param scheduleId ID of the schedule to execute
     */
    function executePayment(uint256 scheduleId) external nonReentrant {
        Schedule storage schedule = schedules[scheduleId];
        
        require(schedule.id != 0, "Schedule does not exist");
        require(schedule.active, "Schedule is not active");
        require(block.timestamp >= schedule.nextPaymentTime, "Payment not due yet");

        // Update next payment time
        schedule.nextPaymentTime = block.timestamp + schedule.intervalSeconds;
        
        // Decrement remaining payments if not unlimited
        if (schedule.remainingPayments > 0) {
            schedule.remainingPayments--;
            if (schedule.remainingPayments == 0) {
                schedule.active = false;
            }
        }

        // Transfer tokens from sender to recipient
        token.safeTransferFrom(schedule.sender, schedule.recipient, schedule.amount);

        emit PaymentExecuted(scheduleId, schedule.sender, schedule.recipient, schedule.amount);
    }

    /**
     * @notice Cancel a scheduled payment (only sender)
     * @param scheduleId ID of the schedule to cancel
     */
    function cancelSchedule(uint256 scheduleId) external {
        Schedule storage schedule = schedules[scheduleId];
        
        require(schedule.id != 0, "Schedule does not exist");
        require(schedule.sender == msg.sender, "Not the sender");
        require(schedule.active, "Already inactive");

        schedule.active = false;

        emit ScheduleCancelled(scheduleId, msg.sender);
    }

    /**
     * @notice Get schedule details
     */
    function getSchedule(uint256 scheduleId) external view returns (Schedule memory) {
        return schedules[scheduleId];
    }

    /**
     * @notice Get active schedules for a sender
     */
    function getActiveSchedulesBySender(address sender) external view returns (Schedule[] memory) {
        uint256[] memory ids = schedulesBySender[sender];
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (schedules[ids[i]].active) activeCount++;
        }
        
        Schedule[] memory active = new Schedule[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (schedules[ids[i]].active) {
                active[idx++] = schedules[ids[i]];
            }
        }
        
        return active;
    }

    /**
     * @notice Check if a payment is due
     */
    function isPaymentDue(uint256 scheduleId) external view returns (bool) {
        Schedule memory schedule = schedules[scheduleId];
        return schedule.id != 0 && schedule.active && block.timestamp >= schedule.nextPaymentTime;
    }

    /**
     * @notice Get time until next payment
     */
    function getTimeUntilNextPayment(uint256 scheduleId) external view returns (uint256) {
        Schedule memory schedule = schedules[scheduleId];
        if (schedule.id == 0 || !schedule.active || block.timestamp >= schedule.nextPaymentTime) {
            return 0;
        }
        return schedule.nextPaymentTime - block.timestamp;
    }
}
