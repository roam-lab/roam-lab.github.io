---
layout: archive
title: "Team"
permalink: /team/
author_profile: true
---

{% assign role_labels = 
  "pi:Principal Investigator,
   phd:PhD Student,
   msc:MSc Student,
   undergrad:Undergraduate Student,
   researcher:Researcher" | split: "," %}

{% assign grouped_roles = "pi,phd,msc,undergrad,researcher" | split: "," %}

{% for role_key in grouped_roles %}
  {% assign role_label = role_labels | where_exp: "pair", "pair contains role_key" | first | split: ":" | last %}
  {% assign group = site.team | where: "role", role_key %}
  {% if group.size > 0 %}
  
  <h2>{{ role_label }}</h2>
  <div class="grid__wrapper">
    {% for person in group %}
      <div class="card__wrapper">
        <div class="card__image">
          {% if person.image %}
            <img src="{{ person.image | relative_url }}" alt="{{ person.title }}" class="img-responsive">
          {% endif %}
        </div>
        <div class="card__body">
          <h3><a href="{{ person.url | relative_url }}">{{ person.title }}</a></h3>
          {% if person.email %}
            <p><a href="mailto:{{ person.email }}">{{ person.email }}</a></p>
          {% endif %}
          {% if person.website %}
            <p><a href="{{ person.website }}" target="_blank">Website</a></p>
          {% endif %}
        </div>
      </div>
    {% endfor %}
  </div>

  {% endif %}
{% endfor %}
