get_file_contents <- function(filenames, expr_source) {
  names(filenames) <- filenames

  file_contents <- lapply(filenames, function(filename) {
    if (filename == "<expr>") {
      return(expr_source)
    }
    if (filename == "<text>") {
      return(NULL)
    }

    filehandle <- tryCatch(
      file(filename, 'rb'),
      error = function(e) NULL,
      warning = function(e) NULL
    )
    # If we can't read file, attempt to extract using source refs
    if (is.null(filehandle)) {
      return(extract_source_from_srcref(filename))
    }
    on.exit( close(filehandle) )

    readChar(filename, 1e6)
  })

  drop_nulls(file_contents)
}

# Given a filename, try to get the source code from source refs. This looks
# inside a package namespace to try to get the source code.
# `filename` will be something like:
#   "/tmp/Rtmp6W0MLC/R.INSTALL1a531f3beb59/ggplot2/R/aes.r"
extract_source_from_srcref <- function(filename) {
  # Name of package containing filename
  pkg <- sub(".*/([^/]+)/R/[^/]+", "\\1", filename)

  # Now grab an arbitrary function from that package
  ns <- asNamespace(pkg)

  # Given a namespace, try to extract source code. It does this by looking at
  # arbitrary functions in the namespace and getting the appropriate attributes.
  # This returns all sources for a package in a single character vector.
  extract_source_from_namespace <- function(ns) {
    ns <- as.list(ns)

    # Look at all the objects in the namespace; when one is found with the
    # appropriate source ref info, return the text.
    for (i in seq_along(ns)) {
      x <- ns[[i]]
      if (is.function(x) && !is.null(attr(x, "srcref", exact = TRUE))) {
        srcref <- attr(x, "srcref", exact = TRUE)
        srcfile <- attr(srcref, "srcfile", exact = TRUE)
        original <- srcfile$original
        return(original$lines)
      }
    }

    NULL
  }

  src <- extract_source_from_namespace(ns)

  # Failed at extracting source refs
  if (is.null(src)) {
    return(NULL)
  }

  # Drop first line (simply contains package name)
  src <- src[-1]

  # Split out all files into separate entries in a list
  full_src_to_file_contents <- function(src) {
    # Lines which contain filenames. Have a format like:
    #   "#line 1 \"/tmp/Rtmp6W0MLC/R.INSTALL1a531f3beb59/ggplot2/R/aaa-.r\""
    filename_idx <- grep('^#line 1 "', src)
    filename_lines <- src[filename_idx]
    filenames <- sub('^#line 1 "(.*)"$', '\\1', filename_lines)

    # Starting and ending indices for the content of each file
    start_idx <- filename_idx + 1
    end_idx <- c(filename_idx[-1] - 1, length(src))

    file_contents <- mapply(start_idx, end_idx, SIMPLIFY = FALSE,
      FUN = function(start, end) {
        content <- src[seq(start, end)]
        paste(content, collapse = "\n")
      }
    )

    names(file_contents) <- filenames
    file_contents
  }

  full_src_to_file_contents(src)[[filename]]
}
