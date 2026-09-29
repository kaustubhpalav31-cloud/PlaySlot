// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PlaySlotBooking
/// @notice Workshop-ready sports turf booking contract.
/// @dev Uses fixed one-hour slots. Prices are demo/test ETH values, not INR.
contract PlaySlotBooking {
    enum BookingStatus {
        Active,
        Cancelled
    }

    struct Booking {
        uint256 id;
        address customer;
        uint8 turfId;
        uint64 startTime;
        uint256 amountPaid;
        BookingStatus status;
    }

    address public immutable owner;
    uint256 public nextBookingId = 1;

    // Demo prices per one-hour slot.
    mapping(uint8 => uint256) public pricePerSlot;

    mapping(uint256 => Booking) public bookings;
    mapping(address => uint256[]) private customerBookingIds;
    mapping(bytes32 => uint256) public bookingIdBySlot;

    event BookingCreated(
        uint256 indexed bookingId,
        address indexed customer,
        uint8 indexed turfId,
        uint64 startTime,
        uint256 amountPaid
    );

    event BookingAdjusted(
        uint256 indexed bookingId,
        uint8 oldTurfId,
        uint64 oldStartTime,
        uint8 newTurfId,
        uint64 newStartTime,
        uint256 newAmountPaid
    );

    event BookingCancelled(
        uint256 indexed bookingId,
        address indexed customer,
        uint256 refundAmount
    );

    error InvalidTurf();
    error InvalidStartTime();
    error SlotAlreadyBooked();
    error WrongPayment();
    error NotBookingOwner();
    error BookingNotActive();
    error InvalidBookingCount();
    error TransferFailed();

    constructor() {
        owner = msg.sender;

        // Small local/test-chain values only.
        pricePerSlot[1] = 0.001 ether;
        pricePerSlot[2] = 0.0012 ether;
        pricePerSlot[3] = 0.0008 ether;
    }

    function slotKey(uint8 turfId, uint64 startTime) public pure returns (bytes32) {
        return keccak256(abi.encode(turfId, startTime));
    }

    function isSlotAvailable(uint8 turfId, uint64 startTime) public view returns (bool) {
        _validateTurf(turfId);
        return bookingIdBySlot[slotKey(turfId, startTime)] == 0;
    }

    /// @notice Book one or more independent one-hour slots for the same turf.
    function bookSlots(uint8 turfId, uint64[] calldata startTimes)
        external
        payable
        returns (uint256[] memory createdIds)
    {
        _validateTurf(turfId);

        uint256 count = startTimes.length;
        if (count == 0 || count > 12) revert InvalidBookingCount();

        uint256 expectedPayment = pricePerSlot[turfId] * count;
        if (msg.value != expectedPayment) revert WrongPayment();

        createdIds = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            createdIds[i] = _createBooking(msg.sender, turfId, startTimes[i], pricePerSlot[turfId]);
        }
    }

    /// @notice Book the same hour repeatedly every N days.
    /// @dev Frontends can use intervalDays=7 for weekly bookings.
    function bookRecurring(
        uint8 turfId,
        uint64 firstStartTime,
        uint16 intervalDays,
        uint8 count
    ) external payable returns (uint256[] memory createdIds) {
        _validateTurf(turfId);

        if (count == 0 || count > 12 || intervalDays == 0) revert InvalidBookingCount();

        uint256 expectedPayment = pricePerSlot[turfId] * count;
        if (msg.value != expectedPayment) revert WrongPayment();

        createdIds = new uint256[](count);
        uint64 intervalSeconds = uint64(intervalDays) * 1 days;

        for (uint8 i = 0; i < count; i++) {
            uint64 slotStart = firstStartTime + (uint64(i) * intervalSeconds);
            createdIds[i] = _createBooking(msg.sender, turfId, slotStart, pricePerSlot[turfId]);
        }
    }

    /// @notice Book multiple selected hours and repeat all of them every N days.
    /// @dev Example: [6 PM, 7 PM] repeated weekly for four weeks in one transaction.
    function bookRecurringSlots(
        uint8 turfId,
        uint64[] calldata firstStartTimes,
        uint16 intervalDays,
        uint8 count
    ) external payable returns (uint256[] memory createdIds) {
        _validateTurf(turfId);

        uint256 slotsPerOccurrence = firstStartTimes.length;
        if (
            slotsPerOccurrence == 0 ||
            slotsPerOccurrence > 6 ||
            count == 0 ||
            count > 12 ||
            intervalDays == 0
        ) revert InvalidBookingCount();

        uint256 totalReservations = slotsPerOccurrence * count;
        uint256 expectedPayment = pricePerSlot[turfId] * totalReservations;
        if (msg.value != expectedPayment) revert WrongPayment();

        createdIds = new uint256[](totalReservations);
        uint64 intervalSeconds = uint64(intervalDays) * 1 days;
        uint256 outputIndex;

        for (uint8 occurrence = 0; occurrence < count; occurrence++) {
            for (uint256 slotIndex = 0; slotIndex < slotsPerOccurrence; slotIndex++) {
                uint64 slotStart =
                    firstStartTimes[slotIndex] +
                    (uint64(occurrence) * intervalSeconds);

                createdIds[outputIndex] = _createBooking(
                    msg.sender,
                    turfId,
                    slotStart,
                    pricePerSlot[turfId]
                );
                outputIndex++;
            }
        }
    }

    /// @notice Move an active booking to another available slot/turf.
    /// @dev If the new turf costs more, send the exact difference.
    ///      If it costs less, the difference is refunded immediately.
    function adjustBooking(
        uint256 bookingId,
        uint8 newTurfId,
        uint64 newStartTime
    ) external payable {
        _validateTurf(newTurfId);

        Booking storage booking = bookings[bookingId];
        if (booking.customer != msg.sender) revert NotBookingOwner();
        if (booking.status != BookingStatus.Active) revert BookingNotActive();

        _validateStartTime(newStartTime);

        bytes32 newKey = slotKey(newTurfId, newStartTime);
        if (bookingIdBySlot[newKey] != 0) revert SlotAlreadyBooked();

        uint256 oldPrice = booking.amountPaid;
        uint256 newPrice = pricePerSlot[newTurfId];

        if (newPrice > oldPrice) {
            if (msg.value != newPrice - oldPrice) revert WrongPayment();
        } else {
            if (msg.value != 0) revert WrongPayment();
        }

        uint8 oldTurfId = booking.turfId;
        uint64 oldStartTime = booking.startTime;

        delete bookingIdBySlot[slotKey(oldTurfId, oldStartTime)];
        bookingIdBySlot[newKey] = bookingId;

        booking.turfId = newTurfId;
        booking.startTime = newStartTime;
        booking.amountPaid = newPrice;

        if (oldPrice > newPrice) {
            uint256 refund = oldPrice - newPrice;
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert TransferFailed();
        }

        emit BookingAdjusted(
            bookingId,
            oldTurfId,
            oldStartTime,
            newTurfId,
            newStartTime,
            newPrice
        );
    }

    /// @notice Cancel an active booking.
    /// @dev Demo refund policy:
    ///      >24h before slot: 90%
    ///      4-24h before slot: 50%
    ///      <=4h before slot: 0%
    function cancelBooking(uint256 bookingId) external {
        Booking storage booking = bookings[bookingId];
        if (booking.customer != msg.sender) revert NotBookingOwner();
        if (booking.status != BookingStatus.Active) revert BookingNotActive();

        booking.status = BookingStatus.Cancelled;
        delete bookingIdBySlot[slotKey(booking.turfId, booking.startTime)];

        uint256 refund;
        if (booking.startTime > block.timestamp + 24 hours) {
            refund = (booking.amountPaid * 90) / 100;
        } else if (booking.startTime > block.timestamp + 4 hours) {
            refund = (booking.amountPaid * 50) / 100;
        }

        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert TransferFailed();
        }

        emit BookingCancelled(bookingId, msg.sender, refund);
    }

    function getCustomerBookingIds(address customer)
        external
        view
        returns (uint256[] memory)
    {
        return customerBookingIds[customer];
    }

    function getCustomerBookings(address customer)
        external
        view
        returns (Booking[] memory result)
    {
        uint256[] storage ids = customerBookingIds[customer];
        result = new Booking[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = bookings[ids[i]];
        }
    }

    function _createBooking(
        address customer,
        uint8 turfId,
        uint64 startTime,
        uint256 amountPaid
    ) internal returns (uint256 bookingId) {
        _validateStartTime(startTime);

        bytes32 key = slotKey(turfId, startTime);
        if (bookingIdBySlot[key] != 0) revert SlotAlreadyBooked();

        bookingId = nextBookingId++;

        bookings[bookingId] = Booking({
            id: bookingId,
            customer: customer,
            turfId: turfId,
            startTime: startTime,
            amountPaid: amountPaid,
            status: BookingStatus.Active
        });

        customerBookingIds[customer].push(bookingId);
        bookingIdBySlot[key] = bookingId;

        emit BookingCreated(bookingId, customer, turfId, startTime, amountPaid);
    }

    function _validateTurf(uint8 turfId) internal view {
        if (pricePerSlot[turfId] == 0) revert InvalidTurf();
    }

    function _validateStartTime(uint64 startTime) internal view {
        if (startTime <= block.timestamp) revert InvalidStartTime();
    }

    receive() external payable {}
}
