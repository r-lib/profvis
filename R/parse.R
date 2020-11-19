#' Parse Rprof output file for use with profvis
#'
#' @param path Path to the \code{\link{Rprof}} output file.
#' @param expr_source If any source refs in the profiling output have an empty
#'   filename, that means they refer to code executed at the R console. This
#'   code can be captured and passed (as a string) as the \code{expr_source}
#'   argument.
#' @import stringr
#' @export
parse_rprof <- function(path = "Rprof.out", expr_source = NULL) {
  parse_rprof_lines(readLines(path), expr_source = expr_source)
}
parse_rprof_lines <- function(lines, expr_source = NULL) {
  stopifnot(is_character(lines))

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

  # Extract memory data from ':m1:m2:m3:d:"c1" "c2" "c3"', and remove the memory
  # stuff from the prof_data strings.
  if (has_memory) {
    mem_data <- gsub("^:(\\d+:\\d+:\\d+:\\d+):.*", "\\1", prof_data)
    mem_data <- str_split(mem_data, ":")
    prof_data <- zap_mem_prefix(prof_data)
  } else {
    mem_data <- rep(NA_character_, length(prof_data))
  }

  # Convert frames with srcrefs from:
  #  "foo" 2#8
  # to
  #  "foo",2#8
  prof_data <- gsub('" (\\d+#\\d+)', '",\\1', prof_data)
  # But if the line starts with a <GC>, it shouldn't be joined like that.
  # Convert:
  #  <GC>,1#7 "foo"
  # back to
  #  <GC> 1#7 "foo"
  prof_data <- gsub('^"<GC>",', '"<GC>" ', prof_data)

  # # Split by ' ' for call stack
  # prof_data <- str_split(prof_data, " ")
  #
  # prof_data <- lapply(prof_data, function(s) {
  #   if (identical(s, "")) character(0)
  #   else s
  # })

  # Parse each line into a separate data frame
  prof_data <- mapply(prof_data, mem_data, seq_along(prof_data), FUN = function(line, mem, time) {
    memalloc <- 0
    if (has_memory) {
      # See memory allocation on r-sources (memory.c):
      # https://github.com/wch/r-source/blob/tags/R-3-0-0/src/main/memory.c#L1845
      # Memory is defined as: small:big:nodes:dupes. Originally, we tracked
      # mem[1:3] to include 'nodes' which track expression allocations.
      # However, the 3rd parameter is internal to the R execution engine since
      # it tracks all expression references and can yield information that's
      # confusing to users. For instance, profiling profvis::pause(1) can yield
      # several hundred MB due to busy waits of pause that trigger significant
      # creation of expressions that is not enterily useful to the end user.
      memalloc <- sum(as.integer(mem[1:2])) / 1024 ^ 2

      # get_current_mem provides the results as either R_SmallVallocSize or R_LargeVallocSize
      # which are internal untis of allocation.
      # https://github.com/wch/r-source/blob/tags/R-3-0-0/src/main/memory.c#L2291.
      #
      # R_SmallVallocSize maps to alloc_size; alloc_size is assigned from size, which depending on
      # the type gets calculated with a macro, for instance, using FLOAT2VEC.
      # https://github.com/wch/r-source/blob/tags/R-3-0-0/src/main/memory.c#L2374
      #
      # FLOAT2VEC and similar functions always divide by sizeof(VECREC).
      # https://github.com/wch/r-source/blob/tags/R-3-0-0/src/include/Defn.h#L400
      #
      # VECREC is defined as follows:
      # typedef struct {
      #   union {
      #     SEXP     backpointer;
      #     double   align;
      #   } u;
      # } VECREC, *VECP;
      #
      # SEXP is defined as typedef struct SEXPREC { ... } SEXPREC, *SEXP;
      # Therefore, SEXP being a pointer if of variable length across different platforms.
      # https://svn.r-project.org/R/trunk/src/include/Rinternals.h
      #
      # On the other hand, align is always a double of 64 bits for both, 64 and 32bit platforms.
      #
      # Therefore, this results needs to be multiplied by 8 bytes.
      memalloc <- memalloc * 8
    }

    # Replace empty strings with character(0); otherwise causes incorrect output
    # later.
    if (identical(line, ""))
      line <- character(0)

    labels <- scan(text = line, what = character(0), quiet = TRUE)

    # If an element in `labels` is just a bare srcref without label, it doesn't
    # actually refer to a function call on the call stack -- instead, it just
    # means that the line of code is being evaluated. This can happen in either
    # of the first 2 elements in `labels`, because it could be "3#19", or it
    # could be "<GC> 3#19" -- the <GC> doesn't count as a real label.
    #
    # Note how the first lineprof() call differs from the ones in the loop:
    # https://github.com/wch/r-source/blob/be7197f/src/main/eval.c#L228-L244 In
    # this case, we'll use NA as the label for now, and later insert the line of
    # source code.
    bare_srcref_idx <- grep("^\\d+#\\d+$", labels[1:2])

    # If found the bare srcref, insert an NA before it.
    if (length(bare_srcref_idx) > 0) {
      after_idx <- seq.int(bare_srcref_idx, length(labels))
      labels <- c(labels[-after_idx], NA_character_, labels[after_idx])
    }

    # Extract the srcrefs. These have the form ",3#12", or "3#12" if it was the
    # first item on the line.
    ref_idx <- grep('^,?\\d+#\\d+$', labels)

    # The number of calls on the stack
    n_calls <- length(labels) - length(ref_idx)

    # Create char vector with srcref strings, of form "3#12" or ",3#12".
    ref_strs <- rep(NA_character_, n_calls)
    ref_strs[ref_idx - seq_along(ref_idx)] <- labels[ref_idx]

    # Remove srcref text from `labels`. Make sure length is >0 because if length
    # is 0, labels[-integer(0)] will drop all entries.
    if (length(ref_idx) > 0)
      labels <- labels[-ref_idx]

    # Get file and line numbers
    ref_strs <- sub('^,', '', ref_strs)
    filenum <- as.integer(sub('#.*', '', ref_strs))
    linenum <- as.integer(sub('.*#', '', ref_strs))

    nrows <- length(labels)
    # Return what is essentially a data frame, but in list format because R is
    # slow at creating data frames here, and slow at rbinding them later. Doing
    # it with lists is about 4-5x faster than with data frames.
    list(
      time = rep(time, nrows),
      depth = if (nrows == 0) integer(0) else seq(nrows, 1),
      label = labels,
      filenum = filenum,
      linenum = linenum,
      # Using numeric(0) for memalloc can be slightly erroneous because memory
      # could have been allocated here due to stuff that happened in the part of
      # the stack that got trimmed off earlier. But there's another way to
      # represent memory usage because it's not associated with a line or
      # function label, only a time stamp, and profvis doesn't record memory
      # usage by time alone -- it must be associated with a function call and
      # optionally, a line of code.
      memalloc = rep(memalloc, nrows)
    )
  }, SIMPLIFY = FALSE, USE.NAMES = FALSE)


  extract_vector <- function(x, name) {
    vecs <- lapply(x, `[[`, name)
    do.call(c, vecs)
  }

  # Bind all the pseudo data-frames together, into a real data frame.
  prof_data <- data.frame(
    time = extract_vector(prof_data, "time"),
    depth = extract_vector(prof_data, "depth"),
    label = extract_vector(prof_data, "label"),
    filenum = extract_vector(prof_data, "filenum"),
    linenum = extract_vector(prof_data, "linenum"),
    memalloc = extract_vector(prof_data, "memalloc"),
    stringsAsFactors = FALSE
  )

  # Compute memory changes
  prof_data$meminc <- append(0, diff(prof_data$memalloc))

  # Add filenames
  prof_data$filename <- labels$path[prof_data$filenum]

  # Get code file contents ---------------------------
  filenames <- unique(prof_data$filename)
  # Drop NA
  filenames <- filenames[!is.na(filenames)]


  file_contents <- get_file_contents(filenames, expr_source)

  # Trim filenames to make output a bit easier to interpret
  prof_data$filename <- trim_filenames(prof_data$filename)
  normpaths <- normalizePath(names(file_contents), winslash = "/", mustWork = FALSE)
  # Workaround for different behavior of normalizePath on Windows. Need to convert
  # "C:/path/to/file/<expr>" back to just "<expr>".
  if (.Platform$OS.type == "windows") {
    normpaths <- sub(file.path(getwd(), "<expr>"), "<expr>", normpaths, fixed = TRUE)
  }
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

zap_mem_prefix <- function(lines) {
  gsub("^:\\d+:\\d+:\\d+:\\d+:", "\\1", lines)
}
zap_file_labels <- function(lines) {
  lines[!grepl("^#", lines)]
}
zap_srcref <- function(lines) {
  gsub(" \\d+#\\d+", "", lines)
}
zap_meta_data <- function(lines) {
  lines <- zap_file_labels(lines)
  lines <- zap_mem_prefix(lines)
  lines
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
