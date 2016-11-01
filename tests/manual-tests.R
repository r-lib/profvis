# These tests must be run manually at the console because R generates source
# refs differently at the console than it does in a test file that is
# `source()`ed.
#
# Unless otherwise specified, the test is simply to run the code and see if
# it produces a usable profile.

if (interactive()) {

  # Files that are sourced. This should show source for <expr> and source.R.
  source("tests/manual-test-source.R", keep.source = TRUE)
  profvis({ f() })


  # Functions with spaces
  profvis({
    `f f` <- function() { pause(0.1) }
    `f f`()
    gc()
  })


  # Missing exprs. The function `f` will not have its source displayed. Also,
  # this should not error.
  f <- function() {

    pause(0.1)
  }
  profvis({ f() })


  # Directories in source file path are not exactly the same as the package
  # name. For example, a file name might be "tidyverse-ggplot2-9f7b08c/R/plot.r"
  devtools::install_github("tidyverse/ggplot2", args = "--with-keep.source",
    force = TRUE)
  library(ggplot2)
  profvis({
    g <- ggplot(mtcars, aes(wt, mpg)) + geom_point()
    print(g)
  })


  # Should show source for files loaded with load_all()
  devtools::load_all("../ggplot2")
  profvis({
    g <- ggplot(mtcars, aes(wt, mpg)) + geom_point()
    print(g)
  })

}
