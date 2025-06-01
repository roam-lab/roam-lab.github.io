---
title: "Enhancing Trajectory Following in VTOL Cargo UAVs: Adaptive Control in Changing Payload Scenarios"
collection: publications
category: conferences
permalink: /publication/ozaslan2023_cargo_uav
excerpt: 'This paper presents a meta-heuristic approach using Gray Wolf Optimization for adaptive control of VTOL cargo UAVs experiencing changing payload dynamics during flight. PID controller parameters are updated in real-time using a lookup table to maintain stability and accuracy.'
date: 2023-10-01
venue: '7th International Symposium on Innovative Approaches in Smart Technologies (ISAS), IEEE'
paperurl: '/files/ozaslan2023_cargo_uav.pdf'
citation: '<i>Duru, A. S., <b>Özaslan, T.</b>, & Soygüder, S. (2023). "Enhancing Trajectory Following in VTOL Cargo UAVs: Adaptive Control in Changing Payload Scenarios." In <i>Proceedings of the 7th International Symposium on Innovative Approaches in Smart Technologies (ISAS)</i>, IEEE, pp. 1–9.</i>'
---
This paper addresses the challenge of performance degradation in UAV control systems caused by varying payload conditions during continuous flight. Conventional PID controllers, while simple and widely used, lack adaptability to dynamic changes in system mass and inertia, especially for vertical takeoff and landing (VTOL) cargo UAVs.

To address this, the authors propose a Gray Wolf Optimization (GWO)–based method to generate a look-up table (LUT) of optimal PID parameters for different payload levels. During flight, the controller interpolates between LUT entries in real-time to adapt to payload-induced dynamic shifts. Simulation results demonstrate improved trajectory tracking accuracy and stability in various payload scenarios, validating the effectiveness of the adaptive control strategy.
