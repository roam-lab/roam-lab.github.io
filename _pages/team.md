---
layout: default
title: "Team"
permalink: /team/
author_profile: false
---

{% assign role_labels = 
  "pi:Faculty,
   phd:PhD Students,
   msc:MSc Students,
   undergrad:Undergraduate Students,
   researcher:Researchers" | split: "," %}

{% assign grouped_roles = "pi,phd,msc,undergrad,researcher" | split: "," %}

<style>
  .team-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 1rem;
  }

  .grid__wrapper {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2rem;
  }

  .card__wrapper {
    flex: 1 1 calc(50% - 1rem);
    max-width: calc(50% - 1rem);
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 1rem;
    display: flex;
    gap: 1rem;
    align-items: center;
    cursor: pointer;
    transition: box-shadow 0.3s ease;
  }

  .card__wrapper:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .card__image img {
    width: 350px;
    height: 150px;
    border-radius: 0%;
    object-fit: cover;
  }

  .card__body h3 {
    margin: 0 0 0.2rem 0;
  }

  .card__body p {
    margin: 0.2rem 0;
  }

  hr.section-divider {
    margin: 3rem 0;
    border: none;
    border-top: 1px solid #ccc;
  }

  @media (max-width: 768px) {
    .card__wrapper {
      flex: 1 1 100%;
      max-width: 100%;
    }
  }
</style>

<div class="team-container">
  {% for role_key in grouped_roles %}
    {% assign role_label = role_labels | where_exp: "pair", "pair contains role_key" | first | split: ":" | last %}
    {% assign group = site.team | where: "role", role_key %}
    {% if group.size > 0 %}

    {% unless forloop.first %}
      <hr class="section-divider">
    {% endunless %}

    <h2>{{ role_label }}</h2>
    <div class="grid__wrapper">
      {% for person in group %}
        <div class="card__wrapper" onclick="location.href='{{ person.url | relative_url }}'">
          <div class="card__image">
            {% assign img_path = '/images/team/' | append: person.slug | append: '.png' %}
            <img src="{{ img_path | relative_url }}"
                 alt="{{ person.title }}"
                 class="img-responsive"
                 onerror="this.onerror=null;this.src='/images/team/default.png';">
          </div>
          <div class="card__body">
            <h3>{{ person.title }}</h3>
            <p style="font-weight: 500;">
              {% case person.role %}
                {% when "pi" %}Principal Investigator
                {% when "phd" %}PhD Student
                {% when "msc" %}MSc Student
                {% when "undergrad" %}Undergraduate Student
                {% when "researcher" %}Researcher
                {% else %}{{ person.role | capitalize }}
              {% endcase %}
            </p>
            {% if person.bio %}
              <p style="font-size: 0.9rem; color: #555;">{{ person.bio | truncatewords: 20 }}</p>
            {% endif %}
          </div>
        </div>
      {% endfor %}
    </div>

    {% endif %}
  {% endfor %}
</div>
