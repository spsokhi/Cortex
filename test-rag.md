# IP Protocol — Overview

## What is IP?

The Internet Protocol (IP) is the principal communications protocol for relaying datagrams across network boundaries. It delivers packets from a source host to a destination host based solely on IP addresses in the packet headers.

## IPv4

IPv4 uses 32-bit addresses, allowing for approximately 4.3 billion unique addresses. An IPv4 address is written as four decimal numbers separated by dots, for example: `192.168.1.1`.

Key IPv4 header fields:
- **Version** — always 4 for IPv4
- **TTL (Time to Live)** — decremented at each hop; packet dropped when it reaches 0
- **Protocol** — identifies the transport layer protocol (6 = TCP, 17 = UDP)
- **Source Address** — 32-bit sender IP
- **Destination Address** — 32-bit receiver IP

## IPv6

IPv6 uses 128-bit addresses to solve IPv4 exhaustion. Addresses are written as eight groups of four hexadecimal digits, for example: `2001:0db8:85a3::8a2e:0370:7334`.

Improvements over IPv4:
- Vastly larger address space (340 undecillion addresses)
- Built-in IPSec support
- No need for NAT
- Simplified header format

## Subnetting

A subnet divides an IP network into smaller segments. The subnet mask defines the network and host portions of an address. For example, `192.168.1.0/24` means the first 24 bits are the network address and the remaining 8 bits identify hosts (254 usable hosts).

## NAT (Network Address Translation)

NAT allows multiple devices on a private network to share a single public IP address. A router rewrites the source IP of outgoing packets and tracks the mapping to forward replies back to the correct internal host.

## CIDR Notation

Classless Inter-Domain Routing (CIDR) replaced the old class-based system. CIDR notation appends a slash and prefix length to the IP address:
- `/8`  — 16 million addresses (e.g. `10.0.0.0/8`)
- `/16` — 65,536 addresses (e.g. `172.16.0.0/16`)
- `/24` — 256 addresses (e.g. `192.168.1.0/24`)
- `/32` — single host
