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
  prof_data <- gsub('(\\d+#\\d+) "', '\\1,"', prof_data)
  prof_data <- str_split(prof_data, fixed(" "))

  # Parse each line into a separate data frame
  prof_data <- mapply(prof_data, seq_along(prof_data), FUN = function(sample, time) {
    funs <- sub("^\\d+#\\d+,", "", sample)
    funs <- sub('^"', '', funs)
    funs <- sub('"$', '', funs)

    refs <- sub('".*"$', '', sample)
    refs <- sub(',$', '', refs)

    filenum <- as.integer(sub('#.*', '', refs))
    linenum <- as.integer(sub('.*#', '', refs))

    data.frame(
      time = time,
      depth = seq(length(sample), 1),
      fun = funs,
      filenum = filenum,
      linenum = linenum,
      stringsAsFactors = FALSE
    )
  }, SIMPLIFY = FALSE)

  prof_data <- do.call(rbind, prof_data)

  # Add filenames
  prof_data$filename <- labels$path[prof_data$filenum]

  prof_data
}

