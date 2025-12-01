#![no_std]

// Common types used across the workspace

pub type Timestamp = u64; // Nanoseconds
pub type Price = i64;     // Fixed point 1e8
pub type Quantity = u64;  // Fixed point 1e8

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstrumentType {
    Spot,
    Perpetual,
    Future,
}
