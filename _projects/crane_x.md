---
title: "CRANE-X: Trajectory Planning for Gantry Crane Systems via RRT"
layout: project
permalink: /projects/crane_x/
description: CRANE-X is a motion planning system for gantry cranes, integrating sampling-based trajectory generation and underactuated control in ROS 2.
image: /images/projects/crane_x/cover.png
images:
  - /images/projects/crane_x/01.png
  - /images/projects/crane_x/02.png
  - /images/projects/crane_x/03.png
completion: "Ongoing"
team: [ozaslan]
---

## 🚧 About CRANE-X

**CRANE-X** (*Crane Reach and Navigation Engine – Experimental*) is a ROS 2-based application that applies Rapidly-exploring Random Trees (RRT) for generating dynamically feasible trajectories for gantry cranes. The system considers underactuated payload dynamics and supports obstacle-aware planning in constrained environments.

---

## 🎥 Demo Video

<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
  <iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID_HERE"
          frameborder="0"
          allowfullscreen
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
  </iframe>
</div>

---

## ✨ Features

- RRT-based global planner for gantry cranes
- Obstacle-avoidance with environment configuration
- Detailed 2D crane dynamics including swing
- Real-time visualization with RViz
- Modular controllers for trolley, rope, and payload

---

## 🔍 Use Cases

- Research in underactuated system control
- Teaching and demonstration for robotic planning
- Industrial automation and material handling studies

---

## 🧠 Technical Notes

CRANE-X leverages ROS 2, OMPL, and custom crane models. The planner produces piecewise waypoints smoothed using interpolation functions. The controller stack supports PID and LQR for closed-loop trajectory tracking, with visual feedback via RViz markers.
