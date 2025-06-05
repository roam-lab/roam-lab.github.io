---
title: "Projects"
permalink: /projects/
layout: archive
author_profile: true
---

{% assign sorted_projects = site.projects | sort: "year" | reverse %}

<div class="grid__wrapper">
  {% for project in sorted_projects %}
    <div class="card__horizontal">
      {% if project.image %}
        <div class="card__horizontal-image">
          <a href="{{ project.url | relative_url }}">
            <img src="{{ project.image | relative_url }}" alt="{{ project.title }}">
          </a>
        </div>
      {% endif %}
      <div class="card__horizontal-body">
        <h3><a href="{{ project.url | relative_url }}">{{ project.title }}</a></h3>
        <p>{{ project.description }}</p>
      </div>
    </div>
  {% endfor %}
</div>
