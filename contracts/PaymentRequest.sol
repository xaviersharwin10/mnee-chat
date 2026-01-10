// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentRequest
 * @notice On-chain payment requests - request tokens from anyone
 * @dev Users can create requests, and payers can fulfill them on-chain
 */
contract PaymentRequest is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Request {
        uint256 id;
        address requester;      // Who is asking for payment
        address payer;          // Who should pay
        uint256 amount;         // Amount in token units
        string note;            // Description of request
        bool fulfilled;         // Has it been paid?
        bool cancelled;         // Was it cancelled?
        uint256 createdAt;      // Timestamp
    }

    IERC20 public immutable token;
    uint256 public nextRequestId;
    
    mapping(uint256 => Request) public requests;
    mapping(address => uint256[]) public requestsByRequester;
    mapping(address => uint256[]) public requestsByPayer;

    event RequestCreated(
        uint256 indexed id,
        address indexed requester,
        address indexed payer,
        uint256 amount,
        string note
    );
    
    event RequestFulfilled(
        uint256 indexed id,
        address indexed requester,
        address indexed payer,
        uint256 amount
    );
    
    event RequestCancelled(uint256 indexed id, address indexed requester);

    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        nextRequestId = 1;
    }

    /**
     * @notice Create a payment request
     * @param payer Address of who should pay
     * @param amount Amount to request (in token decimals)
     * @param note Description of the request
     */
    function createRequest(
        address payer,
        uint256 amount,
        string calldata note
    ) external returns (uint256) {
        require(payer != address(0), "Invalid payer address");
        require(payer != msg.sender, "Cannot request from yourself");
        require(amount > 0, "Amount must be greater than 0");

        uint256 requestId = nextRequestId++;
        
        requests[requestId] = Request({
            id: requestId,
            requester: msg.sender,
            payer: payer,
            amount: amount,
            note: note,
            fulfilled: false,
            cancelled: false,
            createdAt: block.timestamp
        });

        requestsByRequester[msg.sender].push(requestId);
        requestsByPayer[payer].push(requestId);

        emit RequestCreated(requestId, msg.sender, payer, amount, note);
        
        return requestId;
    }

    /**
     * @notice Fulfill/pay a request
     * @param requestId ID of the request to pay
     */
    function fulfillRequest(uint256 requestId) external nonReentrant {
        Request storage req = requests[requestId];
        
        require(req.id != 0, "Request does not exist");
        require(!req.fulfilled, "Already fulfilled");
        require(!req.cancelled, "Request cancelled");
        require(req.payer == msg.sender, "Not the designated payer");

        req.fulfilled = true;

        // Transfer tokens from payer to requester
        token.safeTransferFrom(msg.sender, req.requester, req.amount);

        emit RequestFulfilled(requestId, req.requester, msg.sender, req.amount);
    }

    /**
     * @notice Cancel a request (only requester can cancel)
     * @param requestId ID of the request to cancel
     */
    function cancelRequest(uint256 requestId) external {
        Request storage req = requests[requestId];
        
        require(req.id != 0, "Request does not exist");
        require(req.requester == msg.sender, "Not the requester");
        require(!req.fulfilled, "Already fulfilled");
        require(!req.cancelled, "Already cancelled");

        req.cancelled = true;

        emit RequestCancelled(requestId, msg.sender);
    }

    /**
     * @notice Get request details
     */
    function getRequest(uint256 requestId) external view returns (Request memory) {
        return requests[requestId];
    }

    /**
     * @notice Get all request IDs where user is the requester
     */
    function getRequestsAsRequester(address user) external view returns (uint256[] memory) {
        return requestsByRequester[user];
    }

    /**
     * @notice Get all request IDs where user is the payer
     */
    function getRequestsAsPayer(address user) external view returns (uint256[] memory) {
        return requestsByPayer[user];
    }

    /**
     * @notice Get pending requests for a payer
     */
    function getPendingRequestsAsPayer(address user) external view returns (Request[] memory) {
        uint256[] memory ids = requestsByPayer[user];
        uint256 pendingCount = 0;
        
        // Count pending
        for (uint256 i = 0; i < ids.length; i++) {
            Request memory req = requests[ids[i]];
            if (!req.fulfilled && !req.cancelled) {
                pendingCount++;
            }
        }
        
        // Build array
        Request[] memory pending = new Request[](pendingCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            Request memory req = requests[ids[i]];
            if (!req.fulfilled && !req.cancelled) {
                pending[idx++] = req;
            }
        }
        
        return pending;
    }
}
