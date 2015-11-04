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
    # If we can't read file, return NULL
    if (is.null(filehandle)) {
      return(NULL)
    }
    on.exit( close(filehandle) )

    readChar(filename, 1e6)
  })

  drop_nulls(file_contents)
}
