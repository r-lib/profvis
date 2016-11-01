get_file_contents <- function(filenames, expr_source) {
  filenames <- filenames[filenames != ""]
  names(filenames) <- filenames

  srcfile_cache <- build_srcfile_cache()
  srcfile_cache[["<expr>"]] <- expr_source

  file_contents <- lapply(filenames, function(filename) {
    fetch_cached(filename, srcfile_cache)
  })

  drop_nulls(file_contents)
}

# Fetch a file from the cache, if present. If not already present, read the file
# from disk and add it to the cache.
fetch_cached <- function(filename, srcfile_cache) {
  # If in the cache, simply return it
  if (!is.null(srcfile_cache[[filename]])) {
    return(srcfile_cache[[filename]])
  }

  # If not in the cache, try to read the file
  filehandle <- tryCatch(
    file(filename, 'rb'),
    error = function(e) NULL,
    warning = function(e) NULL
  )
  # If we can't read file, give up
  if (is.null(filehandle)) {
    return(NULL)
  }
  on.exit( close(filehandle) )

  # Add it to the cache
  srcfile_cache[[filename]] <- readChar(filename, file.info(filename)$size,
                                        useBytes = TRUE)
  srcfile_cache[[filename]]
}

build_srcfile_cache <- function(pkgs = loadedNamespaces()) {
  srcfile_cache <- new.env(parent = emptyenv())

  lapply(pkgs, function(pkg) {
    srcrefs <- get_pkg_srcrefs(pkg)
    if (length(srcrefs) > 0)
      list2env(srcrefs, srcfile_cache)
  })

  srcfile_cache
}


# Given a namespace, try to extract source code. It does this by looking at
# functions in the namespace and getting the appropriate attributes. This
# returns a named list with all sources for a package.
get_pkg_srcrefs <- function(pkg) {
  ns_env <- asNamespace(pkg)

  # Given a char vector with contents of an entire package, split out all
  # files into separate entries in a list.
  full_src_to_file_contents <- function(src) {
    # Drop first line (simply contains package name)
    src <- src[-1]

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

  # Get all objects in package. Need to filter out S4 mangled names (.__T__)
  ns_names <- grep("^\\.__[TC]__", ls(ns_env, all.names = TRUE), value = TRUE,
      invert = TRUE, fixed = FALSE)

  files <- list()

  for (name in ns_names) {
    x <- ns_env[[name]]
    if (is.function(x)) {
      srcref <- getSrcref(x)

      # If any function lacks source refs, then no functions in the package will
      # have them. Quit early to save time.
      if (is.null(srcref))
        break

      # There are two possible formats for source refs. If the file was
      # loaded with `source()` (as with `devtools::load_all()`), the lines
      # will just be the cotents of that one file. If the file was from a
      # package that was built and installed the normal way, it will contain
      # the all sources for the entire package.
      srcfile <- attr(srcref, "srcfile", exact = TRUE)

      if (!is.null(srcfile$lines)) {
        # Was loaded with `source(). If we don't already have the source for
        # this file, save them and keep going.
        if (is.null(files[[srcfile$filename]])) {
          files[[srcfile$filename]] <- paste(srcfile$lines, collapse = "\n")
        }

      } else if (!is.null(srcfile$original$lines)) {
        # Was from a built package and therefore contains source for all
        # files in the package. We can extract source code for all files and
        # return.
        files <- full_src_to_file_contents(srcfile$original$lines)
        break

      } else {
        # Shouldn't get here -- if so, this is an unexpected configuration.
        stop("Unexpected format for source refs.")
      }
    }
  }

  files
}


# Looks at all loaded namespaces, and returns a data frame that has mappings
# between filenames and the package they belong to.
package_map <- function(loaded_ns = loadedNamespaces()) {

  # Helper to extract captures
  regcaptures <- function(x, m) {
    ind <- !is.na(m) & m > -1L
    so <- attr(m, "capture.start")[ind]
    eo <- so + attr(m, "capture.length")[ind] - 1L
    substring(x[ind], so, eo)
  }

  res <- lapply(loaded_ns, function(ns) {
    src_lines <- extract_source_from_namespace(ns)

    if (!is.null(src_lines)) {
      # Find and extract the line directives
      m <- regexpr("^#line \\d+ \"(.*)\"$", src_lines, perl = TRUE)
      regcaptures(src_lines, m)
    }
  })

  data.frame(
    filename = unlist(res),
    package = rep(loaded_ns, times = lengths(res)),
    stringsAsFactors = FALSE
  )
}
