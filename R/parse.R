#' Parse Rprof output file for use with profvis
#'
#' @param path Path to the \code{\link{Rprof}} output file.
#' @param expr_source If any source refs in the profiling output have an empty
#'   filename, that means they refer to code executed at the R console. This
#'   code can be captured and passed (as a string) as the \code{expr_source}
#'   argument.
#' @import stringr
parse_rprof <- function(path = "Rprof.out", expr_source = NULL) {
  lines <- readLines(path)

  if (length(lines) < 2) {
    stop("No parsing data available. Maybe your function was too fast?")
  }

  # Parse header, including interval (in ms)
  opts <- str_split(lines[[1]], ": ")[[1]]
  interval <- as.numeric(str_split(opts[length(opts)], "=")[[1]][2]) / 1e3
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

  # Memory profiles start with ':'
  has_memory <- length(prof_data) > 0 && substr(prof_data[[1]], 1, 1) == ":"

  # Remove trailing memory marker from ':m1:m2:m3:d:"c1" "c2" "c3"'
  prof_data <- gsub("^:", "", prof_data)

  # Convert frames with srcrefs from:
  #  "foo" 2#8
  # to
  #  "foo",2#8
  prof_data <- gsub('" (\\d+#\\d+)', '",\\1', prof_data)
  # But if the line starts with <GC>, it shouldn't be joined like that.
  # Convert:
  #  <GC>,1#7 "foo"
  # back to
  #  <GC> 1#7 "foo"
  prof_data <- gsub('^"<GC>",', '"<GC>" ', prof_data)

  # Remove frames related to profvis itself, and all frames below it on the
  # stack. Right now the bottom item can be `profvis`, `profvis::profvis`, or
  # `<Anonymous>`, but once R 3.3 is widespread, the <Anonymous> part can be
  # removed and the regex can be simplified to:
  # ' *"force"(?!.*"force").*"(profvis::)?profvis".*$'
  prof_data <- sub(
    ' *"force" "doTryCatch"(?!.*"force").*"((profvis::)?profvis|<Anonymous>)".*$',
    '', prof_data, perl = TRUE
  )

  # Split by ':' for memory header or ' ' for callstack
  prof_data <- str_split(prof_data, "[: ]")

  # Replace empty strings with character(0); otherwise causes incorrect output
  # later.
  prof_data <- lapply(prof_data, function(s) {
    if (identical(s, "")) character(0)
    else s
  })

  # Parse each line into a separate data frame
  prof_data <- mapply(prof_data, seq_along(prof_data), FUN = function(sample, time) {
    memalloc <- 0
    if (has_memory) {
      # Memory is defined as: small:big:nodes:dupes
      memalloc <- sum(as.integer(sample[1:3])) / 1024 ^ 2
      sample <- sample[-4:-1]
    }

    labels <- sample
    labels <- sub('",\\d+#\\d+$', '"', labels)
    labels <- sub('^"', '', labels)
    labels <- sub('"$', '', labels)
    # If it's just a bare srcref without label, it doesn't actually refer to
    # a function call on the call stack -- instead, it just means that the
    # line of code is being evaluated.
    # Note how the first lineprof() call differs from the ones in the loop:
    # https://github.com/wch/r-source/blob/be7197f/src/main/eval.c#L228-L244
    # In this case, we'll use NA as the label for new, and later insert the
    # line of source code.
    idx <- grepl("^\\d+#\\d+$", sample)
    labels[idx] <- NA

    refs <- sample
    refs <- sub('^".*"[,]?', '', refs)
    refs[!nzchar(refs)] <- NA
    filenum <- as.integer(sub('#.*', '', refs))
    linenum <- as.integer(sub('.*#', '', refs))

    # Flag for special case of zero entries on this row
    nonzero <- length(sample) != 0

    data.frame(
      time = if (nonzero) time else numeric(0),
      depth = if (nonzero) seq(length(sample), 1) else integer(0),
      label = labels,
      filenum = filenum,
      linenum = linenum,
      memalloc = memalloc,
      stringsAsFactors = FALSE
    )
  }, SIMPLIFY = FALSE)

  prof_data <- do.call(rbind, prof_data)

  # Compute memory changes
  prof_data$meminc <- append(0, diff(prof_data$memalloc))

  # Add filenames
  prof_data$filename <- labels$path[prof_data$filenum]
  # Rename "" files to "<expr>". Code executed from the console is labeled as
  # a file named "".
  prof_data$filename[prof_data$filename == ""] <- "<expr>"
  # Rename "<text>" to "<expr>". Code executed in knitr blocks is labeled as
  # a file named "<text>"
  prof_data$filename[prof_data$filename == "<text>"] <- "<expr>"

  # Get code file contents ---------------------------
  filenames <- unique(prof_data$filename)
  # Drop NA
  filenames <- filenames[!is.na(filenames)]


  file_contents <- get_file_contents(filenames, expr_source)

  # Trim filenames to make output a bit easier to interpret
  prof_data$filename <- trim_filenames(prof_data$filename)
  suppressWarnings(normpaths <- normalizePath(names(file_contents)))
  names(file_contents) <- trim_filenames(names(file_contents))

  # Remove srcref info from the prof_data in cases where no file is present.
  no_file_idx <- !(prof_data$filename %in% names(file_contents))
  prof_data$filename[no_file_idx] <- NA
  prof_data$filenum[no_file_idx] <- NA
  prof_data$linenum[no_file_idx] <- NA

  # Because we removed srcrefs when no file is present, there can be cases where
  # the label is NA and we couldn't read the file. This is when the profiler
  # output is like '1#2 "foo" "bar"' -- when the first item is a ref that
  # points to a file we couldn't read. We need to remove these NAs because we
  # don't have any useful information about them.
  prof_data <- prof_data[!(is.na(prof_data$label) & no_file_idx), ]

  # Add labels for where there's a srcref but no function on the call stack.
  # This can happen for frames at the top level.
  prof_data <- insert_code_line_labels(prof_data, file_contents)

  # Remove references to <expr> when the source for a given exprression was
  # outside of the profvis({}) call.
  prof_data <- prune_expr_mismatch(prof_data, file_contents[["<expr>"]])

  # Convert file_contents to a format suitable for client
  file_contents <- mapply(names(file_contents), file_contents, normpaths,
    FUN = function(filename, content, normpath) {
      list(filename = filename, content = content, normpath = normpath)
    }, SIMPLIFY = FALSE, USE.NAMES = FALSE)

  list(
    prof = prof_data,
    interval = interval,
    files = file_contents
  )
}

# For any rows where label is NA and there's a srcref, insert the line of code
# as the label.
insert_code_line_labels <- function(prof_data, file_contents) {
  file_label_contents <- lapply(file_contents, function(content) {
    content <- str_split(content, "\n")[[1]]
    sub("^ +", "", content)
  })

  # Indices where a filename is present and the label is NA
  filename_idx <- !is.na(prof_data$filename) & is.na(prof_data$label)

  # Get the labels
  labels <- mapply(
    prof_data$filename[filename_idx],
    prof_data$linenum[filename_idx],
    FUN = function(filename, linenum) {
      if (filename == "")
        return("")
      file_label_contents[[filename]][linenum]
    }, SIMPLIFY = FALSE)
  labels <- unlist(labels, use.names = FALSE)
  # Insert the labels at appropriate indices
  prof_data$label[filename_idx] <- labels

  prof_data
}


trim_filenames <- function(filenames) {
  # Strip off current working directory from filenames
  filenames <- sub(getwd(), "", filenames, fixed = TRUE)

  # Replace /xxx/yyy/package/R/zzz.R with package/R/zzz.R, and same for inst/.
  filenames <- sub("^.*?([^/]+/(R|inst)/.*\\.R$)", "\\1", filenames, ignore.case = TRUE)

  filenames
}

# Some rows of data will have <expr> as the source ref, but the source they
# refer to was actually outside of the profvis({}) call, so we don't have
# access to the source. We'll filter out those rows by using this heuristic: if
# the label on that row is not found in the line of <expr> text, then we don't
# have the expr for it. This isn't perfect, but it should be right in the vast
# majority of cases, and it's probably the best we can do.
# https://github.com/rstudio/profvis/issues/15
prune_expr_mismatch <- function(prof_data, expr_source) {
  if (is.null(expr_source)) {
    expr_source <- ""
  }
  expr <- strsplit(expr_source, "\n")[[1]]

  # Only look at entries from <expr>, pull out relevant columns, and
  # deduplicate.
  p <- prof_data[!is.na(prof_data$filename) & prof_data$filename == "<expr>",
                 c("label", "linenum", "filename")]
  p <- unique(p)

  # Allow profiles with no sources and no <exprs> to be parsed
  if (nrow(p) == 0) {
    return (prof_data)
  }

  # Now make sure that each entry actually matches text in expr. This isn't
  # perfect - there can be false negatives, as in the times_10_lazy example
  # in the vignette.
  p$match <- NA
  for (i in seq_len(nrow(p))) {

    if (p$linenum[i] > length(expr)) {
      # If the line number is outside of what expr contains, this is because
      # it's code that the user ran outside of profvis({}).
      p$match[i] <- FALSE

    } else {
      # If the label is "<Anonymous>", don't check for a string match in the
      # code, because we don't know exactly how it was invoked; be lenient.
      # Also be a little lenient and allow expr to be on next line - this can
      # happen when flow control statements are used without curly braces, like:
      # if (TRUE)
      #   pause(0.1)
      label <- p$label[i]
      expr_line <- expr[p$linenum[i]]
      next_line <- expr[p$linenum[i] + 1]

      p$match[i] <- label == "<Anonymous>" ||
                    grepl(label, expr_line, fixed = TRUE) ||
                    grepl(label, next_line, fixed = TRUE)
    }
  }

  # Merge back with original data. The match column now tells us which rows we
  # we don't actually have source references for.
  p <- merge(prof_data, p, all.x = TRUE, sort = FALSE)
  p[!is.na(p$match) & p$match == FALSE, c("linenum", "filename", "filenum")] <- NA
  p
}
