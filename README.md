Profvis
=======

Profvis is a tool for visualizing code profiling data from R. It creates a web page which provides a graphical interface for exploring the data. [Live demo](http://rpubs.com/wch/124655)


## Installation

Profvis is not yet on CRAN; it is currently available from GitHub. Make sure you have the devtools package installed, and then run:

```R
devtools::install_github("rstudio/profvis")
```

## Documentation

See the [introduction vignette](http://rpubs.com/wch/123888).

## Example

To run code with profiling, wrap the expression in `profvis()`. By default, this will result in the interactive profile visualizer opening in a web browser. You can see a live demo [here](http://rpubs.com/wch/124655).

```R
library(profvis)
library(ggplot2)  # We'll profile a ggplot graphic

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
