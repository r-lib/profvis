# `rprof_lines()` collects profiles

    Code
      writeLines(unique(out))
    Output
      "pause" "f"

---

    Code
      cat_rprof(f())
    Output
      "pause" "f"

# `filter.callframes` filters out intervening frames

    Code
      cat_rprof(f(), filter.callframes = TRUE)
    Output
      "pause" "h" "g" "f" 

---

    Code
      cat_rprof(f(), filter.callframes = TRUE)
    Output
      "pause" "f" 

