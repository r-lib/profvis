#' @import stringr
parse_rprof <- function(path = "Rprof.out") {
  lines <- readLines(path)

  if (length(lines) < 2) {
    stop("No parsing data available. Maybe your function was too fast?")
  }

  # Parse header, including interval
  opts <- str_split(lines[[1]], ": ")[[1]]
  interval <- as.numeric(str_split(opts[length(opts)], "=")[[1]][2]) / 1e6
  lines <- lines[-1]

  # Separate file labels and profiling data
  is_label <- grepl("^#", lines)

  label_lines <- lines[is_label]
  label_pieces <- str_split_fixed(label_lines, ": ", 2)
  labels <- data.frame(
    label = as.integer(sub("^#File ", "", label_pieces[, 1])),
    path = label_pieces[, 2],
    stringsAsFactors = FALSE
  )

  # Parse profiling data -----------------
  prof_lines <- lines[!is_label]
  prof_data <- sub(' +$', '', prof_lines)
  # Convert frames with srcrefs from:
  #  "foo" 2#8
  # to
  #  "foo",2#8
  prof_data <- gsub('" (\\d+#\\d+)', '",\\1', prof_data)

  # Remove frames related to profvis itself
  prof_data <- sub('"force".*?"prof"$', '', prof_data)
  prof_data <- str_split(prof_data, fixed(" "))

  # Parse each line into a separate data frame
  prof_data <- mapply(prof_data, seq_along(prof_data), FUN = function(sample, time) {
    # If the first thing is a srcref, it doesn't actually refer to a function
    # call on the call stack -- instead, it seems that it refers to the code
    # that's currently being eval'ed.
    # Note how the first lineprof() call differs from the ones in the loop:
    # https://github.com/wch/r-source/blob/be7197f/src/main/eval.c#L228-L244
    # In this case, we'll temporarily use "??" as the label, until we have a
    # better solution.
    if (grepl("^\\d+#\\d+$", sample[1])) {
      sample[1] <- paste0('"??",', sample[1])
    }

    # These entries are references into files
    ref_idx <- grepl("^\\d+#\\d+$", sample)

    labels <- sample
    labels <- sub('",\\d+#\\d+$', '"', labels)
    labels <- sub('^"', '', labels)
    labels <- sub('"$', '', labels)

    refs <- sample
    refs <- sub('^".*"[,]?', '', refs)
    refs[!nzchar(refs)] <- NA
    filenum <- as.integer(sub('#.*', '', refs))
    linenum <- as.integer(sub('.*#', '', refs))

    data.frame(
      time = time,
      depth = seq(length(sample), 1),
      label = labels,
      filenum = filenum,
      linenum = linenum,
      stringsAsFactors = FALSE
    )
  }, SIMPLIFY = FALSE)

  prof_data <- do.call(rbind, prof_data)

  # Add filenames
  prof_data$filename <- labels$path[prof_data$filenum]

  # Get code file contents ---------------------------
  filenames <- unique(prof_data$filename)
  # Drop NA and ""
  filenames <- filenames[!(is.na(filenames) | filenames == "")]

  # Get file contents
  names(filenames) <- filenames
  file_contents <- lapply(filenames, function(filename) {
    readChar(filename, 1e6)
  })

  # Convert file_contents to a format suitable for client
  file_contents <- mapply(names(file_contents), file_contents,
    FUN = function(filename, content) {
      list(filename = filename, content = content)
    }, SIMPLIFY = FALSE, USE.NAMES = FALSE)

  list(
    prof = prof_data,
    files = file_contents
  )
}


