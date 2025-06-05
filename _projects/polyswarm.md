---
title: "PolySwarm: Multi-UAV Trajectory Generation and Control Framework"
layout: project
permalink: /projects/polyswarm/
description: PolySwarm is a C++ and ROS 2-based control and trajectory generation framework for multi-drone systems, supporting dynamic disturbance modeling, detailed quadrotor physics, and layered control architecture.
image: /images/projects/polyswarm/cover.png  # Replace with actual image path
images:
  - /images/projects/polyswarm/01.png
  - /images/projects/polyswarm/02.png
  - /images/projects/polyswarm/03.png
completion: "Ongoing"
team: [sarioglu]  # Replace with correct slugs
---

## 🚁 Project Overview

**PolySwarm** is an advanced C++ framework built on **ROS 2**, designed to simulate and control multiple quadrotor UAVs navigating complex environments with precision and realism.

At its core, the system supports **polynomial trajectory generation** based on constraints like **minimum time, acceleration, jerk, snap, crackle**, or any weighted combination. It includes detailed **quadrotor dynamics**, multi-layer control architecture, and **inter-agent aerodynamic disturbance modeling** — such as **propeller downwash effects**.

---

## 🧱 Key Capabilities

- ✅ Real-time multi-agent trajectory tracking
- ✅ Generation of **minimum-snap/jerk/time/crackle** polynomial paths
- ✅ Detailed physics: propulsion, attitude, and rigid-body dynamics
- ✅ Full-stack control hierarchy:
  - Low-level: **motor thrust & torque response**
  - Mid-level: **attitude and thrust control**
  - High-level: **position, heading, and waypoint following**
- ✅ **Downwash modeling**: if a UAV flies under another, the disturbance is applied

---

## 🧠 Architecture Layers

1. **High-Level Planning**
   - Waypoint sequences connected using optimized polynomial segments
   - User-defined objectives: minimum-time, minimum-energy, etc.

2. **Mid-Level Control**
   - Position & yaw control using PID, LQR, or geometric control
   - Integral compensation and derivative prediction

3. **Low-Level Dynamics**
   - Motor lag, torque/thrust saturation, noise injection
   - Feedback controllers for angular velocity and orientation

4. **Multi-Agent Interaction**
   - Disturbance-aware controllers based on vehicle proximity
   - Downwash effect modeled as a function of rotor thrust and vertical offset

---

## 📽️ Simulation Video

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
          frameborder="0"
          allowfullscreen
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
  </iframe>
</div>

---

## ⚙️ Technologies Used

- **C++ 20**
- **ROS 2 Foxy / Humble**
- **Eigen** for fast matrix math
- **yaml-cpp** for controller configs
- **rviz2** and **PlotJuggler** for real-time diagnostics

---

## 📦 Repository Structure (Example)

<pre lang="bash"> 
    bash polyswarm_ws/ 
    ├── src/ │ 
    │   ├── traj_gen/ # Polynomial trajectory generator  
    │   ├── quad_dynamics/ # Detailed UAV physics engine │ 
    │   ├── swarm_manager/ # Multi-agent coordination & downwash modeling 
    │   └── controllers/ # Low-mid-high level control nodes 
    └── config/ 
        ├── traj_profiles.yaml 
        └── uav_models.yaml
</pre>