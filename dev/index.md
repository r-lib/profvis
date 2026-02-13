# profvis

profvis is a tool for visualizing code profiling data from R. It creates
a web page which provides a graphical interface for exploring the data.

## Installation

``` r
install.packages("profvis")
```

## Example

To run code with profiling, wrap the expression in
[`profvis()`](https://profvis.r-lib.org/dev/reference/profvis.md). By
default, this will result in the interactive profile visualizer opening
in a web browser.

``` r
library(profvis)

f <- function() {
  pause(0.1)
  g()
  h()
}
g <- function() {
  pause(0.1)
  h()
}
h <- function() {
  pause(0.1)
}

profvis(f())
```

The [`profvis()`](https://profvis.r-lib.org/dev/reference/profvis.md)
call returns an [htmlwidget](http://www.htmlwidgets.org/), which by
default when printed opens a web browser. If you wish to save the
object, it won’t open the browser at first, but you can view it later by
typing the variable name at the console, or calling
[`print()`](https://rdrr.io/r/base/print.html) on it.

``` r
p <- profvis(f())

# View it with:
p
# or print(p)
```
