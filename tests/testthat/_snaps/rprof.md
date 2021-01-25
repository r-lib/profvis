# `rprof_lines()` collects profiles

    Code
      writeLines(modal_value0(out))
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

# stack is correctly stripped even with metadata profiling

    Code
      writeLines(zap(metadata))
    Output
      "pause" "f"

---

    Code
      writeLines(zap(metadata_simplified))
    Output
      "pause" "f"

