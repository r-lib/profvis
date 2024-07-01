Profvis
=======

<!-- badges: start -->
[![R-CMD-check](https://github.com/r-lib/profvis/actions/workflows/R-CMD-check.yaml/badge.svg)](https://github.com/r-lib/profvis/actions/workflows/R-CMD-check.yaml)
[![Codecov test coverage](https://codecov.io/gh/r-lib/profvis/graph/badge.svg)](https://codecov.io/gh/r-lib/profvis)
<!-- badges: end -->

Profvis is a tool for visualizing code profiling data from R. It creates a web page which provides a graphical interface for exploring the data.


## Installation

```R
install.packages("profvis")
```

## Documentation

See the [documentation site](https://rstudio.github.io/profvis/).

## Example

To run code with profiling, wrap the expression in `profvis()`. By default, this will result in the interactive profile visualizer opening in a web browser.

```R
library(profvis)
library(ggplot2)

profvis({
  g <- ggplot(diamonds, aes(carat, price)) + geom_point(size = 1, alpha = 0.2)
  print(g)
})
```


The `profvis()` call returns an [htmlwidget](http://www.htmlwidgets.org/), which by default when printed opens a web browser. If you wish to save the object, it won't open the browser at first, but you can view it later by typing the variable name at the console, or calling `print()` on it.

```R
p <- profvis({
  g <- ggplot(diamonds, aes(carat, price)) + geom_point(size = 1, alpha = 0.2)
  print(g)
})


# View it with:
p
# or print(p)
```
