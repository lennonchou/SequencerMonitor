
# svn info --xml | sed -n '1,6p;18,24p' > svninfo.xml
# svn info | sed -n '1,6p;18,24p' > svninfo.txt
svn info | grep Last > svninfo.txt
