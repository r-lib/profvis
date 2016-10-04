get_file_contents <- function(filenames, expr_source) {
  names(filenames) <- filenames

  srcref_cache <- new.env(parent = emptyenv())

  file_contents <- lapply(filenames, function(filename) {
    if (filename == "<expr>") {
      return(expr_source)
    }

    filehandle <- tryCatch(
      file(filename, 'rb'),
      error = function(e) NULL,
      warning = function(e) NULL
    )
    # If we can't read file, attempt to extract using source refs
    if (is.null(filehandle)) {
      return(extract_source_from_srcref(filename, srcref_cache))
    }
    on.exit( close(filehandle) )

    readChar(filename, file.info(filename)$size, useBytes = TRUE)
  })

  drop_nulls(file_contents)
}


# Given a filename, try to get the source code from source refs. This looks
# inside a package namespace to try to get the source code.
# `filename` will be something like:
#   "/tmp/Rtmp6W0MLC/R.INSTALL1a531f3beb59/ggplot2/R/aes.r"
extract_source_from_srcref <- function(filename, srcref_cache) {
  # Filename must have format "xxx/yyy/R/zzz.r", where the "xxx" part can be
  # anything.
  if (!grepl(".*/([^/]+)/R/[^/]+", filename)) {
    return(NULL)
  }

  # If it's not already cached, add it.
  if (is.null(srcref_cache[[filename]])) {
    # Name of package containing filename.
    pkgdir <- sub(".*/([^/]+)/R/[^/]+", "\\1", filename)

    # Try to infer the package name from the package directory.
    pkg <- infer_package_name(pkgdir)
    if (is.null(pkg)) {
      return(NULL)
    }
    load_pkg_into_cache(pkg, srcref_cache)
  }

  srcref_cache[[filename]]
}


load_pkg_into_cache <- function(pkg, srcref_cache) {
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

  file_contents <- full_src_to_file_contents(src)
  list2env(file_contents, envir = srcref_cache)
}


# Given a string like "webshot" or "wch-webshot-d5979a2", try to infer the name
# of the package. `devtools::install_github()` will result in names like
# "wch-webshot-d5979a2", but downloading a zip file from GitHub's web interface
# will result in "webshot-master" or "webshot-feature-branch". So the possible
# formats include: "xxx-pkgname-yyy", "pkgname-xxx-yyy", and "pkgname-xxx", and
# possibly others. After guessing what the name is, this function checks that a
# package by that name is installed. If so, it will return it. If this function
# can't infer the name (a package must be installed with the inferred name), it
# returns NULL.
infer_package_name <- function(str) {
  parts <- strsplit(str, "-", fixed = TRUE)[[1]]

  # str was something like "webshot".
  if (length(parts) == 1) {
    if (is_installed(str)) {
      return(str)
    } else {
      message("Unable to infer package name from directory named '", str, "'")
      return(NULL)
    }
  }

  # If there's a single "-", the format is probably "pkgname-xxx", though we'll
  # try "xxx-pkgname" also.
  if (length(parts) == 2) {
    if (is_installed(parts[1])) {
      return(parts[1])
    } else if (is_installed(parts[2])) {
      return(parts[2])
    } else {
      message("Unable to infer package name from directory named '", str, "'")
      return(NULL)
    }
  }

  # If there are two "-", then the format could be "xxx-pkgname-yyy" or
  # "pkgname-xxx-yyy". The first is most likely (because devtools uses it), so
  # we'll try it first.
  if (length(parts) == 3) {
    if (is_installed(parts[2]))
      return(parts[2])

    if (is_installed(parts[1]))
      return(parts[1])
  }

  # None of the above matched, so it could be "xxx-yyy-pkgname", or there could
  # be more parts. We'll just try each piece.
  for (i in seq(3, length(parts))) {
    if (is_installed(parts[i]))
      return(parts[i])
  }

  # If we got here, nothing worked.
  message("Unable to infer package name from directory named '", str, "'")
  NULL
}
